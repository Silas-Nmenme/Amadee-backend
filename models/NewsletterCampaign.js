import mongoose from "mongoose";

const newsletterCampaignSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 12000 },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subscriber" }],
    recipientCount: { type: Number, required: true, min: 0 },
    nextRecipientIndex: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    skippedCount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["queued", "sending", "completed", "completed_with_errors"],
      default: "queued",
      index: true,
    },
    lockToken: { type: String, select: false },
    lockUntil: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const NewsletterCampaign = mongoose.models.NewsletterCampaign ||
  mongoose.model("NewsletterCampaign", newsletterCampaignSchema);

export default NewsletterCampaign;