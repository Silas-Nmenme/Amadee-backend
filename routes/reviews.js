
import { Router } from "express";
import { z } from "zod";

import Review from "../models/Review.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";

const router = Router();

const reviewSchema = z.object({
  name: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(1500),
});

/**
 * GET /api/reviews
 * Return approved reviews, newest first.
 */
router.get("/", async (_req, res, next) => {
  try {
    const reviews = await Review.find({ approved: true })
      .select("name rating message productId createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ reviews });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reviews
 * Submit a review for admin moderation.
 */
router.post(
  "/",
  formLimiter,
  validate(reviewSchema),
  async (req, res, next) => {
    try {
      const { name, rating, message } = req.validatedBody;

      const review = await Review.create({
        name,
        rating,
        message,
        approved: false,
      });

      return res.status(201).json({
        message: "Review submitted for moderation.",
        review: {
          id: review._id,
          name: review.name,
          rating: review.rating,
          message: review.message,
          createdAt: review.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
