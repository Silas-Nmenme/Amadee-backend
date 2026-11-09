import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { paystackWebhook } from "../controllers/paymentsController.js";
import Order from "../models/Order.js";

test("signed Paystack charge.failed events claim one notification without marking the order paid", async t => {
  const previousSecret = process.env.PAYSTACK_SECRET_KEY;
  const secret = "test-paystack-secret";
  process.env.PAYSTACK_SECRET_KEY = secret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecret;
  });

  const event = { event: "charge.failed", data: { reference: "AS-FAILED-001" } };
  const rawBody = Buffer.from(JSON.stringify(event));
  const signature = createHmac("sha512", secret).update(rawBody).digest("hex");
  let filter;
  let update;
  t.mock.method(Order, "findOneAndUpdate", async (query, changes) => {
    filter = query;
    update = changes;
    return {
      orderId: "AS-FAILED-001",
      customer: { name: "Customer", email: "customer@example.com" },
      total: 12000,
      paymentStatus: "pending",
    };
  });

  const res = {
    statusCode: null,
    sendStatus(code) { this.statusCode = code; return this; },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await paystackWebhook({
      body: event,
      rawBody,
      get: name => name === "x-paystack-signature" ? signature : undefined,
    }, res, error => { throw error; });
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    console.error = originalError;
  }

  assert.equal(filter.paymentMethod, "paystack");
  assert.deepEqual(filter.paymentStatus.$in, ["pending", "failed"]);
  assert.equal(filter.paymentFailureNotifiedAt.$exists, false);
  assert.ok(update.$set.paymentFailureNotifiedAt instanceof Date);
  assert.equal(update.$set.paymentStatus, undefined);
  assert.equal(res.statusCode, 200);
});