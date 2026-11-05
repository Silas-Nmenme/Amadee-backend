import assert from "node:assert/strict";
import test from "node:test";

import {
  getPreferences,
  replaceCart,
  replaceWishlist,
} from "../controllers/accountController.js";
import accountRouter from "../routes/account.js";
import ordersRouter from "../routes/orders.js";

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

test("order creation and account preference routes require authentication", () => {
  const createOrderRoute = ordersRouter.stack.find(
    layer => layer.route?.path === '/' && layer.route.methods.post
  );
  const myOrdersRoute = ordersRouter.stack.find(
    layer => layer.route?.path === '/mine' && layer.route.methods.get
  );
  assert.ok(createOrderRoute);
  assert.ok(createOrderRoute.route.stack.some(layer => layer.name === 'requireAuth'));
  assert.ok(myOrdersRoute);
  assert.ok(myOrdersRoute.route.stack.some(layer => layer.name === 'requireAuth'));

  const customerRequestRoute = ordersRouter.stack.find(
    layer => layer.route?.path === '/:orderId/requests' && layer.route.methods.post
  );
  assert.ok(customerRequestRoute);
  assert.ok(customerRequestRoute.route.stack.some(layer => layer.name === 'requireAuth'));

  for (const [path, method] of [
    ['/:orderId/tracking', 'patch'],
    ['/:orderId/requests/:requestId', 'patch'],
    ['/:orderId/requests/:requestId/refund', 'post'],
  ]) {
    const adminRoute = ordersRouter.stack.find(
      layer => layer.route?.path === path && layer.route.methods[method]
    );
    assert.ok(adminRoute, `Expected admin route ${method.toUpperCase()} ${path}`);
    assert.ok(adminRoute.route.stack.some(layer => layer.name === 'requireAuth'));
    assert.ok(adminRoute.route.stack.some(layer => layer.name === 'requireAdmin'));
  }

  const authLayer = accountRouter.stack.find(layer => layer.name === 'requireAuth');
  assert.ok(authLayer);
  assert.ok(accountRouter.stack.some(layer => layer.route?.path === '/preferences'));
  assert.ok(accountRouter.stack.some(layer => layer.route?.path === '/cart'));
  assert.ok(accountRouter.stack.some(layer => layer.route?.path === '/wishlist'));
});

test("account preferences return only the authenticated user's saved selections", async () => {
  const res = responseRecorder();
  await getPreferences({
    user: {
      cartItems: [{ productId: 'AS-001', quantity: 1 }],
      wishlistProductIds: ['AS-002'],
    },
  }, res);

  assert.deepEqual(res.body, {
    cartItems: [{ productId: 'AS-001', quantity: 1 }],
    wishlistProductIds: ['AS-002'],
  });
});

test("cart preferences validate and persist bounded cart selections", async () => {
  let saved = false;
  const req = {
    body: {
      cartItems: [{
        productId: 'AS-001',
        size: 'M',
        colour: 'Teal',
        quantity: 2,
      }],
    },
    user: {
      cartItems: [],
      async save() { saved = true; },
    },
  };
  const res = responseRecorder();
  await replaceCart(req, res, error => { throw error; });
  assert.equal(saved, true);
  assert.equal(res.body.cartItems[0].productId, 'AS-001');

  saved = false;
  req.body.cartItems[0].quantity = 21;
  const invalidRes = responseRecorder();
  await replaceCart(req, invalidRes, error => { throw error; });
  assert.equal(invalidRes.statusCode, 400);
  assert.equal(saved, false);
});

test("wishlist preferences deduplicate IDs before saving", async () => {
  const req = {
    body: { wishlistProductIds: ['AS-001', 'AS-001', 'AS-002'] },
    user: {
      wishlistProductIds: [],
      async save() {},
    },
  };
  const res = responseRecorder();
  await replaceWishlist(req, res, error => { throw error; });
  assert.deepEqual(res.body.wishlistProductIds, ['AS-001', 'AS-002']);
});
