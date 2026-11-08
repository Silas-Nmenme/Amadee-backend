import { Router } from "express";
import { z } from "zod";

import {
  deleteReview,
  getApprovedReviews,
  getPendingReviews,
  moderateReview,
  submitReview,
} from "../controllers/reviewsController.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

const reviewSchema = z.object({
  name: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(1500),
  productId: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform(value => value.toUpperCase()).optional(),
  website: z.string().max(200).optional().default(""),
});

const moderationSchema = z.object({
  approved: z.boolean(),
});

router.get("/pending", requireAuth, requireAdmin, getPendingReviews);

router.patch(
  "/:id/moderate",
  requireAuth,
  requireAdmin,
  validateObjectId(),
  validate(moderationSchema),
  moderateReview
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validateObjectId(),
  deleteReview
);

router.get("/", getApprovedReviews);
router.post("/", formLimiter, validate(reviewSchema), submitReview);

export default router;
