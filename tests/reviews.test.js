import assert from "node:assert/strict";
import test from "node:test";

import { getApprovedReviews } from "../controllers/reviewsController.js";
import Review from "../models/Review.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("approved review lookup can be scoped to a normalized product code", async t => {
  let filter;
  const query = {
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [],
  };
  t.mock.method(Review, "find", value => { filter = value; return query; });
  const res = responseRecorder();

  await getApprovedReviews({ query: { productId: "as-001" } }, res, error => { throw error; });

  assert.deepEqual(filter, { approved: true, productId: "AS-001" });
  assert.deepEqual(res.body.reviews, []);
});

test("approved review lookup rejects malformed product codes", async () => {
  const res = responseRecorder();
  await getApprovedReviews({ query: { productId: "<script>" } }, res, error => { throw error; });
  assert.equal(res.statusCode, 400);
});

test("store-wide approved review lookup excludes product-specific reviews", async t => {
  let filter;
  const query = {
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [],
  };
  t.mock.method(Review, "find", value => { filter = value; return query; });
  const res = responseRecorder();

  await getApprovedReviews({ query: {} }, res, error => { throw error; });

  assert.deepEqual(filter, {
    approved: true,
    $or: [{ productId: { $exists: false } }, { productId: "" }],
  });
});