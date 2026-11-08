import assert from "node:assert/strict";
import test from "node:test";

import { unsubscribeNewsletter } from "../controllers/newsletterController.js";
import Subscriber from "../models/Subscriber.js";
import newsletterRouter from "../routes/newsletter.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("unsubscribe route validates a token and deactivates the matching subscriber", async t => {
  let filter;
  let update;
  t.mock.method(Subscriber, "findOneAndUpdate", async (query, changes) => {
    filter = query;
    update = changes;
    return { active: false };
  });
  const token = "x".repeat(43);
  const res = responseRecorder();

  await unsubscribeNewsletter({ validatedBody: { token } }, res, error => { throw error; });

  assert.equal(filter.active, true);
  assert.equal(filter.unsubscribeToken.length, 64);
  assert.equal(update.$set.active, false);
  assert.equal(update.$unset.unsubscribeToken, 1);
  assert.match(res.body.message, /unsubscribed/);
  const route = newsletterRouter.stack.find(
    layer => layer.route?.path === "/unsubscribe" && layer.route.methods.post
  );
  assert.ok(route);
});