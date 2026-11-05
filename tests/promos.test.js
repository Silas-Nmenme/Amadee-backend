import assert from "node:assert/strict";
import test from "node:test";

import {
  createPromo,
  getActivePromotions,
  validatePromo,
} from "../controllers/promoController.js";
import { createOrder } from "../controllers/ordersController.js";
import { Promo } from "../models/Promo.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import {
  calculatePromoDiscount,
  findUsablePromo,
  PROMO_ALREADY_USED_MESSAGE,
  reservePromoUse,
} from "../services/promoService.js";
import { promoAdminSchema } from "../validators/promoValidator.js";

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

const activePromo = {
  _id: "promo-id",
  code: "STITCH10",
  name: "Stitch into savings",
  type: "percent",
  value: 10,
  minSubtotal: 5000,
  maxUses: 2,
  uses: 1,
  redeemedBy: [],
  applicableProductCodes: ["AS-001"],
  active: true,
};

test("campaign schema validates percentages and requires announcement copy when publishing", () => {
  const campaign = {
    code: "stitch10",
    name: "Stitch into savings",
    type: "percent",
    value: 10,
    publishAnnouncement: true,
    announcementText: "Save on your next outfit.",
  };
  const parsed = promoAdminSchema.safeParse(campaign);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.code, "STITCH10");
  assert.equal(promoAdminSchema.safeParse({ ...campaign, value: 101 }).success, false);
  assert.equal(promoAdminSchema.safeParse({ ...campaign, announcementText: "" }).success, false);
  assert.equal(promoAdminSchema.safeParse({ ...campaign, code: "BAD CODE" }).success, false);
});

test("promo calculation applies only to eligible items and enforces order conditions", () => {
  const items = [
    { productId: "AS-001", lineTotal: 10000 },
    { productId: "AS-002", lineTotal: 15000 },
  ];
  assert.deepEqual(calculatePromoDiscount(activePromo, items, 25000), {
    discount: 1000,
    eligibleSubtotal: 10000,
  });
  assert.throws(
    () => calculatePromoDiscount({ ...activePromo, minSubtotal: 30000 }, items, 25000),
    /minimum order/
  );
  assert.throws(
    () => calculatePromoDiscount({ ...activePromo, applicableProductCodes: ["AS-003"] }, items, 25000),
    /does not apply/
  );
  assert.equal(
    calculatePromoDiscount({ type: "fixed", value: 12000, minSubtotal: 0 }, [
      { productId: "AS-001", lineTotal: 10000 },
    ], 10000).discount,
    10000
  );
});

test("promo validation prices products on the server and returns a campaign quote", async t => {
  t.mock.method(Promo, "findOne", () => ({ lean: async () => activePromo }));
  t.mock.method(Product, "find", () => ({
    select() { return this; },
    lean: async () => [{ productCode: "AS-001", price: 10000 }],
  }));
  const res = responseRecorder();

  await validatePromo({
    validatedBody: { code: "STITCH10", items: [{ productId: "AS-001", quantity: 2 }] },
    user: { _id: "507f1f77bcf86cd799439011" },
  }, res, error => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.subtotal, 20000);
  assert.equal(res.body.discount, 2000);
  assert.equal(res.body.totalAfterDiscount, 18000);
});

test("repeat redemption is rejected with the requested message during code validation", async t => {
  const userId = "507f1f77bcf86cd799439011";
  t.mock.method(Promo, "findOne", () => ({
    lean: async () => ({ ...activePromo, redeemedBy: [userId] }),
  }));
  let receivedError;
  const res = responseRecorder();

  await validatePromo({
    validatedBody: { code: "STITCH10", items: [] },
    user: { _id: userId },
  }, res, error => { receivedError = error; });

  assert.equal(receivedError.message, "this code as been used already by you.");
});

test("public announcements include only published active campaigns", async t => {
  let query;
  t.mock.method(Promo, "find", filter => {
    query = filter;
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      lean: async () => [activePromo],
    };
  });
  const res = responseRecorder();

  await getActivePromotions({}, res, error => { throw error; });

  assert.equal(query.active, true);
  assert.equal(query.publishAnnouncement, true);
  assert.equal(res.body.promotions.length, 1);
});

test("campaign creation returns the persisted campaign", async t => {
  const created = { ...activePromo };
  t.mock.method(Promo, "create", async data => ({ ...data, _id: created._id }));
  const res = responseRecorder();

  await createPromo({ validatedBody: { code: "STITCH10", name: "Stitch into savings" } }, res, error => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.promo._id, created._id);
});

test("redemption reservation atomically checks the remaining use limit", async t => {
  let filter;
  let update;
  t.mock.method(Promo, "findOneAndUpdate", async (query, change) => {
    filter = query;
    update = change;
    return { uses: 2 };
  });

  const userId = "507f1f77bcf86cd799439011";
  await reservePromoUse(activePromo, userId);

  assert.equal(filter._id, activePromo._id);
  assert.deepEqual(filter.redeemedBy, { $ne: userId });
  assert.deepEqual(filter.$and[1], {
    $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }],
  });
  assert.deepEqual(update, {
    $inc: { uses: 1 },
    $addToSet: { redeemedBy: userId },
  });
});

test("concurrent repeat redemption returns the requested message", async t => {
  const userId = "507f1f77bcf86cd799439011";
  t.mock.method(Promo, "findOneAndUpdate", async () => null);
  t.mock.method(Promo, "findById", () => ({
    select() { return this; },
    lean: async () => ({ redeemedBy: [userId] }),
  }));

  await assert.rejects(
    reservePromoUse(activePromo, userId),
    error => error.status === 400 && error.message === PROMO_ALREADY_USED_MESSAGE
  );
});

test("unredeemed customers can still use campaign codes until the campaign limit is reached", async t => {
  t.mock.method(Promo, "findOne", () => ({
    lean: async () => ({ ...activePromo, redeemedBy: ["507f191e810c19729de860ea"] }),
  }));

  const promo = await findUsablePromo("stitch10", "507f1f77bcf86cd799439011");
  assert.equal(promo.code, activePromo.code);
});

test("order creation recalculates and persists promo discount from backend prices", async t => {
  let savedOrder;
  const product = {
    productCode: "AS-001",
    name: "Ankara dress",
    price: 10000,
    stock: 5,
    sizes: ["M"],
    colours: ["Blue"],
  };
  t.mock.method(Product, "find", () => ({ lean: async () => [product] }));
  t.mock.method(Promo, "findOne", () => ({ lean: async () => activePromo }));
  let reservationUpdate;
  t.mock.method(Promo, "findOneAndUpdate", async (_query, update) => {
    reservationUpdate = update;
    return { uses: 2 };
  });
  t.mock.method(Order, "create", async data => {
    savedOrder = data;
    return data;
  });
  t.mock.method(User, "updateOne", async () => ({ acknowledged: true }));
  const res = responseRecorder();
  const previousError = console.error;
  console.error = () => {};

  try {
    await createOrder({
      validatedBody: {
        customer: { name: "Customer", email: "customer@example.com", phone: "08000000000", address: "Lagos" },
        items: [{ productId: "AS-001", quantity: 2, size: "M", colour: "Blue" }],
        deliveryOption: "pickup",
        promoCode: "STITCH10",
        measurements: {},
        paymentMethod: "bank_transfer",
      },
      user: { _id: "user-id", name: "Customer", email: "customer@example.com" },
    }, res, error => { throw error; });
  } finally {
    console.error = previousError;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(savedOrder.subtotal, 20000);
  assert.equal(savedOrder.discount, 2000);
  assert.equal(savedOrder.total, 18000);
  assert.equal(savedOrder.promoCode, "STITCH10");
  assert.equal(savedOrder.promoCampaignName, activePromo.name);
  assert.deepEqual(reservationUpdate.$addToSet.redeemedBy, "user-id");
});
