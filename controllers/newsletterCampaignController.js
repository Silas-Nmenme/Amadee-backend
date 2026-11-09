import { randomBytes, randomUUID, createHash } from "node:crypto";

import NewsletterCampaign from "../models/NewsletterCampaign.js";
import Subscriber from "../models/Subscriber.js";
import { sendBestEffortMail } from "../services/mailer.js";
import { newsletterCampaignEmail } from "../templates/emailTemplates.js";

const BATCH_SIZE = Math.min(25, Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE) || 10));
const LOCK_DURATION_MS = 90_000;

function campaignSummary(campaign) {
  return {
    id: String(campaign._id),
    subject: campaign.subject,
    recipientCount: campaign.recipientCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    skippedCount: campaign.skippedCount,
    status: campaign.status,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    nextRecipientIndex: campaign.nextRecipientIndex,
  };
}

export async function createNewsletterCampaign(req, res, next) {
  try {
    const subscribers = await Subscriber.find({ active: true })
      .select("_id")
      .lean();
    if (!subscribers.length) {
      return res.status(409).json({ message: "There are no active subscribers to receive this newsletter." });
    }

    const campaign = await NewsletterCampaign.create({
      ...req.validatedBody,
      recipients: subscribers.map(subscriber => subscriber._id),
      recipientCount: subscribers.length,
      status: "queued",
    });

    return res.status(202).json({
      campaign: campaignSummary(campaign),
      message: "Newsletter queued for delivery.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function getNewsletterCampaigns(_req, res, next) {
  try {
    const campaigns = await NewsletterCampaign.find()
      .select("subject recipientCount sentCount failedCount skippedCount status createdAt startedAt completedAt nextRecipientIndex")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.status(200).json({ campaigns: campaigns.map(campaignSummary) });
  } catch (error) {
    return next(error);
  }
}

async function ensureUnsubscribeToken(subscriber) {
  if (subscriber.unsubscribeToken) return subscriber.unsubscribeToken;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const updated = await Subscriber.findOneAndUpdate(
    {
      _id: subscriber._id,
      active: true,
      $or: [
        { unsubscribeToken: { $exists: false } },
        { unsubscribeToken: null },
        { unsubscribeToken: "" },
      ],
    },
    { $set: { unsubscribeToken: tokenHash } },
    { new: true },
  ).select("unsubscribeToken").lean();

  if (updated?.unsubscribeToken) return updated.unsubscribeToken;
  const current = await Subscriber.findOne({ _id: subscriber._id, active: true })
    .select("unsubscribeToken")
    .lean();
  return current?.unsubscribeToken || "";
}

export async function processNewsletterCampaignBatch(req, res, next) {
  const lockToken = randomUUID();
  const now = new Date();
  try {
    const campaign = await NewsletterCampaign.findOneAndUpdate(
      {
        _id: req.params.campaignId,
        status: { $in: ["queued", "sending"] },
        $or: [
          { lockUntil: null },
          { lockUntil: { $exists: false } },
          { lockUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "sending",
          lockToken,
          lockUntil: new Date(now.getTime() + LOCK_DURATION_MS),
          startedAt: now,
        },
      },
      { new: true },
    ).select("+lockToken");

    if (!campaign) {
      const current = await NewsletterCampaign.findById(req.params.campaignId)
        .select("subject recipientCount sentCount failedCount skippedCount status createdAt startedAt completedAt nextRecipientIndex")
        .lean();
      if (!current) return res.status(404).json({ message: "Newsletter campaign not found." });
      if (["completed", "completed_with_errors"].includes(current.status)) {
        return res.status(200).json({ campaign: campaignSummary(current), done: true });
      }
      return res.status(409).json({ message: "This newsletter batch is already being processed." });
    }

    const start = campaign.nextRecipientIndex;
    const end = Math.min(start + BATCH_SIZE, campaign.recipients.length);
    const batchIds = campaign.recipients.slice(start, end);
    const subscribers = batchIds.length
      ? await Subscriber.find({ _id: { $in: batchIds }, active: true })
        .select("email unsubscribeToken")
        .lean()
      : [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = batchIds.length - subscribers.length;

    await Promise.all(subscribers.map(async subscriber => {
      try {
        const unsubscribeToken = await ensureUnsubscribeToken(subscriber);
        if (!unsubscribeToken) {
          skippedCount += 1;
          return;
        }
        const sent = await sendBestEffortMail({
          event: "Newsletter campaign delivery",
          to: subscriber.email,
          ...newsletterCampaignEmail({
            subject: campaign.subject,
            message: campaign.message,
            unsubscribeToken,
          }),
        });
        if (sent) sentCount += 1;
        else failedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error("Newsletter campaign recipient failed:", error?.message || error);
      }
    }));

    const isComplete = end >= campaign.recipients.length;
    const nextStatus = isComplete
      ? (campaign.failedCount + failedCount > 0 ? "completed_with_errors" : "completed")
      : "sending";
    const updated = await NewsletterCampaign.findOneAndUpdate(
      { _id: campaign._id, lockToken },
      {
        $set: {
          nextRecipientIndex: end,
          status: nextStatus,
          ...(isComplete ? { completedAt: new Date() } : {}),
        },
        $inc: { sentCount, failedCount, skippedCount },
        $unset: { lockToken: 1, lockUntil: 1 },
      },
      { new: true },
    ).select("subject recipientCount sentCount failedCount skippedCount status createdAt startedAt completedAt nextRecipientIndex").lean();

    return res.status(200).json({
      campaign: campaignSummary(updated),
      done: isComplete,
      batchSize: batchIds.length,
    });
  } catch (error) {
    await NewsletterCampaign.updateOne(
      { _id: req.params.campaignId, lockToken },
      { $unset: { lockToken: 1, lockUntil: 1 } },
    ).catch(() => {});
    return next(error);
  }
}