import mongoose from "mongoose";

const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or naira
    minSubtotal: { type: Number, default: 0, min: 0 },
    applicableProductCodes: { type: [String], default: [] },
    maxUses: { type: Number, default: null }, // null = unlimited
    uses: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    publishAnnouncement: { type: Boolean, default: false },
    announcementText: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

export const Promo = mongoose.models.Promo || mongoose.model("Promo", promoSchema);
