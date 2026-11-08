import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminMessages,
  updateAdminMessageHandled,
} from "../controllers/adminController.js";
import Message from "../models/Message.js";
import adminRouter from "../routes/admin.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("admin contact inbox paginates messages and reports unhandled count", async t => {
  const messages = [{ _id: "message-1", email: "customer@example.com" }];
  const query = {
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => messages,
  };
  t.mock.method(Message, "find", () => query);
  t.mock.method(Message, "countDocuments", async filter => filter ? 1 : 3);
  const res = responseRecorder();

  await getAdminMessages({ query: { page: "1", limit: "25" } }, res, error => { throw error; });

  assert.equal(res.body.messages, messages);
  assert.equal(res.body.unhandled, 1);
  assert.equal(res.body.pagination.total, 3);
});

test("admin can toggle a message's handled state", async t => {
  let update;
  t.mock.method(Message, "findByIdAndUpdate", async (_id, changes) => {
    update = changes;
    return { handled: true };
  });
  const res = responseRecorder();

  await updateAdminMessageHandled({
    params: { messageId: "507f1f77bcf86cd799439011" },
    validatedBody: { handled: true },
  }, res, error => { throw error; });

  assert.equal(update.$set.handled, true);
  assert.ok(update.$set.handledAt instanceof Date);
  assert.equal(res.statusCode, 200);
  assert.ok(adminRouter.stack.some(layer => layer.name === "requireAdmin"));
});