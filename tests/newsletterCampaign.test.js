import assert from "node:assert/strict";
import test from "node:test";

import {
  createNewsletterCampaign,
  processNewsletterCampaignBatch,
} from "../controllers/newsletterCampaignController.js";
import NewsletterCampaign from "../models/NewsletterCampaign.js";
import Subscriber from "../models/Subscriber.js";
import adminRouter from "../routes/admin.js";
import { newsletterCampaignSchema } from "../validators/newsletterValidator.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function query(value) {
  return {
    select() { return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

test("newsletter campaign schema validates subject and plain-text body", () => {
  assert.equal(newsletterCampaignSchema.safeParse({
    subject: "New collection",
    message: "Our new collection is here.",
  }).success, true);
  assert.equal(newsletterCampaignSchema.safeParse({
    subject: "Subject\nInjected header",
    message: "Our new collection is here.",
  }).success, false);
  assert.equal(newsletterCampaignSchema.safeParse({
    subject: "Hi",
    message: "Short",
  }).success, false);
});

test("campaign creation queues all active subscriber IDs", async t => {
  const subscriberIds = [{ _id: "sub-1" }, { _id: "sub-2" }];
  let filter;
  let created;
  t.mock.method(Subscriber, "find", value => {
    filter = value;
    return query(subscriberIds);
  });
  t.mock.method(NewsletterCampaign, "create", async value => {
    created = value;
    return { ...value, _id: "campaign-1", createdAt: new Date() };
  });
  const res = responseRecorder();

  await createNewsletterCampaign({
    validatedBody: { subject: "New collection", message: "Our new collection is here." },
  }, res, error => { throw error; });

  assert.deepEqual(filter, { active: true });
  assert.deepEqual(created.recipients, ["sub-1", "sub-2"]);
  assert.equal(created.recipientCount, 2);
  assert.equal(res.statusCode, 202);
});

test("campaign batch skips unsubscribed recipients and records isolated mail failures", async t => {
  const campaign = {
    _id: "campaign-1",
    subject: "New collection",
    message: "Our new collection is here.",
    recipients: ["sub-active-1", "sub-active-2", "sub-unsubscribed"],
    recipientCount: 3,
    nextRecipientIndex: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    status: "queued",
    createdAt: new Date(),
  };
  const completed = {
    ...campaign,
    nextRecipientIndex: 3,
    failedCount: 2,
    skippedCount: 1,
    status: "completed_with_errors",
    completedAt: new Date(),
  };
  let callCount = 0;
  let subscriberFilter;
  t.mock.method(NewsletterCampaign, "findOneAndUpdate", (...args) => {
    callCount += 1;
    if (callCount === 1) return query(campaign);
    assert.equal(args[1].$inc.failedCount, 2);
    assert.equal(args[1].$inc.skippedCount, 1);
    return query(completed);
  });
  t.mock.method(Subscriber, "find", value => {
    subscriberFilter = value;
    return query([
      { _id: "sub-active-1", email: "active1@example.com", unsubscribeToken: "a".repeat(64) },
      { _id: "sub-active-2", email: "active2@example.com", unsubscribeToken: "b".repeat(64) },
    ]);
  });
  const res = responseRecorder();
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await processNewsletterCampaignBatch({ params: { campaignId: "campaign-1" } }, res, error => { throw error; });
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(subscriberFilter, { _id: { $in: ["sub-active-1", "sub-active-2", "sub-unsubscribed"] }, active: true });
  assert.equal(res.body.done, true);
  assert.equal(res.body.campaign.failedCount, 2);
  assert.equal(res.body.campaign.skippedCount, 1);
  assert.equal(logged.filter(args => String(args[0]).startsWith("Newsletter campaign delivery email failed:")).length, 2);
});

test("newsletter campaign endpoints are registered behind admin middleware", () => {
  assert.ok(adminRouter.stack.some(layer => layer.name === "requireAuth"));
  assert.ok(adminRouter.stack.some(layer => layer.name === "requireAdmin"));
  assert.ok(adminRouter.stack.some(layer => layer.route?.path === "/newsletters" && layer.route.methods.post));
  assert.ok(adminRouter.stack.some(layer => layer.route?.path === "/newsletters/:campaignId/process" && layer.route.methods.post));
});