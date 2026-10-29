import mongoose from "mongoose";

// One live code per (email, purpose). MongoDB deletes expired rows by itself (TTL index),
// and because it lives in the database it works across several server instances.
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  purpose: { type: String, enum: ["verify", "reset"], required: true },
  hash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

export const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);
