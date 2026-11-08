import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmManualPayment,
  confirmOrderRefund,
  createOrderRequest,
  reviewOrderRequest,
} from "../controllers/ordersController.js";
import Order from "../models/Order.js";
import {
  orderSchema,
  orderRequestSchema,
  refundSchema,
  trackingSchema,
  manualPaymentSchema,
} from "../validators/orderValidator.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("customer order requests are created only against the authenticated user's order", async t => {
  let filter;
  const request = {
    _id: "request-1",
    type: "cancellation",
    reason: "I need to cancel this order",
    status: "pending",
    requestedAt: new Date(),
  };
  const order = {
    customer: { email: "customer@example.com" },
    orderRequests: [request],
  };
  t.mock.method(Order, "findOneAndUpdate", async (query, update) => {
    filter = query;
    assert.deepEqual(update.$push.orderRequests, {
      type: "cancellation",
      reason: "I need to cancel this order",
      status: "pending",
      requestedAt: update.$push.orderRequests.requestedAt,
    });
    return order;
  });
  const res = responseRecorder();

  await createOrderRequest({
    params: { orderId: "AS-OWNED-001" },
    user: { _id: "user-123" },
    validatedBody: { type: "cancellation", reason: "I need to cancel this order" },
  }, res, error => { throw error; });

  assert.equal(filter.user, "user-123");
  assert.equal(filter.orderId, "AS-OWNED-001");
  assert.deepEqual(filter.orderStatus.$in, ["received", "confirmed", "in_production", "ready"]);
  assert.equal(filter.$nor[0].orderRequests.$elemMatch.status, "pending");
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.request.status, "pending");
});

test("admin review atomically updates only a pending order request", async t => {
  const request = {
    _id: "request-2",
    type: "cancellation",
    status: "pending",
    reason: "I ordered the wrong size",
  };
  const existingOrder = {
    orderRequests: { id: () => request },
  };
  let updateFilter;
  let update;
  const updatedOrder = {
    customer: { email: "customer@example.com" },
    orderRequests: { id: () => ({ ...request, status: "approved" }) },
  };
  t.mock.method(Order, "findOne", async () => existingOrder);
  t.mock.method(Order, "findOneAndUpdate", async (query, changes) => {
    updateFilter = query;
    update = changes;
    return updatedOrder;
  });
  const res = responseRecorder();

  await reviewOrderRequest({
    params: { orderId: "AS-OWNED-002", requestId: "request-2" },
    validatedBody: { decision: "approved", reviewNote: "Approved." },
  }, res, error => { throw error; });

  assert.equal(updateFilter.orderRequests.$elemMatch.status, "pending");
  assert.equal(update.$set["orderRequests.$.status"], "approved");
  assert.equal(update.$set.orderStatus, "cancelled");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.order, updatedOrder);
});

test("refund is recorded only on a paid order with an approved request", async t => {
  let filter;
  let update;
  const request = { _id: "request-3", status: "refunded", type: "return" };
  const order = {
    customer: { email: "customer@example.com" },
    orderRequests: { id: () => request },
  };
  t.mock.method(Order, "findOneAndUpdate", async (query, changes) => {
    filter = query;
    update = changes;
    return order;
  });
  const res = responseRecorder();

  await confirmOrderRefund({
    params: { orderId: "AS-OWNED-003", requestId: "request-3" },
    validatedBody: { refundReference: "BANK-REF-19", confirmRefunded: true },
  }, res, error => { throw error; });

  assert.equal(filter.paymentStatus, "paid");
  assert.equal(filter.$and[0].orderRequests.$elemMatch.status, "approved");
  assert.equal(update.$set.paymentStatus, "refunded");
  assert.equal(update.$set["orderRequests.$.status"], "refunded");
  assert.equal(res.statusCode, 200);
});

test("request, tracking URL, and refund validation reject unsafe or incomplete input", () => {
  assert.equal(orderRequestSchema.safeParse({
    type: "return",
    reason: "Item arrived damaged",
  }).success, true);
  assert.equal(orderRequestSchema.safeParse({
    type: "cancellation",
    reason: "x",
  }).success, false);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "javascript:alert(1)" }).success, false);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "https://carrier.example/track/1" }).success, true);
  assert.equal(refundSchema.safeParse({
    refundReference: "REF-1",
    confirmRefunded: false,
  }).success, false);
});

test("manual payment references are optional and bounded", () => {
  assert.equal(manualPaymentSchema.safeParse({}).success, true);
  assert.equal(manualPaymentSchema.safeParse({ paymentReference: "BANK-REF-19" }).success, true);
  assert.equal(manualPaymentSchema.safeParse({ paymentReference: "x".repeat(201) }).success, false);
});

test("order schema accepts optional structured centimetre measurements", () => {
  const parsed = orderSchema.parse({
    customer: {
      name: "Customer Name",
      email: "customer@example.com",
      phone: "08000000000",
      address: "Lagos",
    },
    items: [{ productId: "AS-001", quantity: 1, size: "Custom", colour: "Blue" }],
    deliveryOption: "lagos",
    paymentMethod: "bank_transfer",
    measurements: { bustChest: 92.5, waist: "72", hip: 98, length: 110, notes: "Leave room" },
  });

  assert.equal(parsed.measurements.bustChest, 92.5);
  assert.equal(parsed.measurements.waist, "72");
  assert.equal(parsed.measurements.notes, "Leave room");
});

test("manual payment confirmation is restricted to pending non-Paystack orders", async t => {
  let filter;
  let update;
  const order = { customer: { email: "customer@example.com" } };
  t.mock.method(Order, "findOneAndUpdate", async (query, changes) => {
    filter = query;
    update = changes;
    return order;
  });
  const res = responseRecorder();

  await confirmManualPayment({
    params: { orderId: "AS-MANUAL-001" },
    validatedBody: { paymentReference: "BANK-REF-19" },
  }, res, error => { throw error; });

  assert.deepEqual(filter.paymentMethod.$in, ["bank_transfer", "pay_on_delivery"]);
  assert.equal(filter.paymentStatus, "pending");
  assert.equal(filter.inventoryRestoredAt.$exists, false);
  assert.equal(update.$set.paymentStatus, "paid");
  assert.equal(update.$set.paymentReference, "BANK-REF-19");
  assert.equal(res.statusCode, 200);
});
