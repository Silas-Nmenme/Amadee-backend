import assert from "node:assert/strict";
import test from "node:test";

import { getAdminSummary } from "../controllers/adminController.js";
import { getAdminOrders, getMyOrders } from "../controllers/ordersController.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import Subscriber from "../models/Subscriber.js";
import User from "../models/User.js";

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

function queryReturning(value) {
  const query = {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => value,
  };
  return query;
}

test("admin order list includes product images for each order item", async t => {
  const orders = [{
    orderId: "AM-001",
    items: [{ productId: "AS-001", name: "Blue dress", quantity: 1 }],
  }];
  let productFilter;
  t.mock.method(Order, "find", () => queryReturning(orders));
  t.mock.method(Order, "countDocuments", async () => 1);
  t.mock.method(Product, "find", filter => {
    productFilter = filter;
    return queryReturning([{
      productCode: "AS-001",
      images: ["https://res.cloudinary.com/test/dress.jpg"],
    }]);
  });
  const res = responseRecorder();

  await getAdminOrders({ query: { page: "1", limit: "25" } }, res, error => { throw error; });

  assert.deepEqual(productFilter, { productCode: { $in: ["AS-001"] } });
  assert.equal(
    res.body.orders[0].items[0].image,
    "https://res.cloudinary.com/test/dress.jpg"
  );
  assert.equal(res.body.pagination.total, 1);
});

test("customer order history is scoped to the signed-in user and includes item images", async t => {
  const userId = "507f1f77bcf86cd799439011";
  let orderFilter;
  t.mock.method(Order, "find", filter => {
    orderFilter = filter;
    return queryReturning([{
      orderId: "AS-OWNED-001",
      items: [{ productId: "AS-001", name: "Blue dress", quantity: 2 }],
    }]);
  });
  t.mock.method(Product, "find", () => queryReturning([{
    productCode: "AS-001",
    images: ["https://res.cloudinary.com/test/dress.jpg"],
  }]));
  const res = responseRecorder();

  await getMyOrders({ user: { _id: userId } }, res, error => { throw error; });

  assert.deepEqual(orderFilter, { user: userId });
  assert.equal(res.body.orders[0].items[0].image, "https://res.cloudinary.com/test/dress.jpg");
  assert.equal(res.body.orders[0].items[0].quantity, 2);
});

test("admin revenue includes only paid orders", async t => {
  let aggregationPipeline;
  t.mock.method(Order, "countDocuments", async () => 12);
  t.mock.method(User, "countDocuments", async () => 8);
  t.mock.method(Review, "countDocuments", async () => 2);
  t.mock.method(Subscriber, "countDocuments", async () => 3);
  t.mock.method(Order, "aggregate", async pipeline => {
    aggregationPipeline = pipeline;
    return [{ paidCount: 2, total: 175000 }];
  });
  const res = responseRecorder();

  await getAdminSummary({}, res, error => { throw error; });

  assert.deepEqual(aggregationPipeline[0].$match, { paymentStatus: "paid" });
  assert.deepEqual(aggregationPipeline[1].$group.paidCount, {
    $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
  });
  assert.equal(res.body.summary.paidOrders, 2);
  assert.equal(res.body.summary.revenueNgn, 175000);
});
