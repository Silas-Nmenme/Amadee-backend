import mongoose from "mongoose";

const promoSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or naira
    minSubtotal: { type: Number, default: 0 },
    maxUses: { type: Number, default: null }, // null = unlimited
    uses: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Promo = mongoose.models.Promo || mongoose.model("Promo", promoSchema);
