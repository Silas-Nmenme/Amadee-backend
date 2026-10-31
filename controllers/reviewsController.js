import { Router } from "express";
import { z } from "zod";
import Review from "../models/Review.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(1500)
});
router.get("/", async (_req, res, next) => {
  try {
    const reviews = await Review.find({ approved: true }).select("name rating message createdAt").sort({ createdAt: -1 }).limit(100).lean();
    res.json({ reviews: reviews.map(r => ({ ...r, id: String(r._id) })) });
  } catch (err) { next(err); }
});
router.post("/", formLimiter, validate(schema), async (req, res, next) => {
  try {
    await Review.create(req.validatedBody);
    res.status(201).json({ message: "Review submitted for moderation." });
  } catch (err) { next(err); }
});
router.get("/pending", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const reviews = await Review.find({ approved: false }).sort({ createdAt: 1 }).limit(100).lean();
    res.json({ reviews });
  } catch (err) { next(err); }
});
router.patch("/:id/moderate", requireAuth, requireAdmin, validate(z.object({ approved: z.boolean() })), async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, {
      $set: { approved: req.validatedBody.approved, moderatedBy: req.user._id }
    }, { new: true, runValidators: true }).select("name rating message approved createdAt");
    if (!review) return res.status(404).json({ message: "Review not found." });
    res.json({ review });
  } catch (err) { next(err); }
});
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await Review.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Review not found." });
    res.json({ message: "Review deleted." });
  } catch (err) { next(err); }
});
export default router;
