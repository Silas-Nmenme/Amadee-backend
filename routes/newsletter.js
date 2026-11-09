import { Router } from "express";
import { z } from "zod";

import {
  submitNewsletterSubscription,
  unsubscribeNewsletter,
} from "../controllers/newsletterController.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";

const router = Router();
const schema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(""),
});

const unsubscribeSchema = z.object({
  token: z.string().regex(/^(?:[A-Za-z0-9_-]{43}|[a-fA-F0-9]{64})$/),
});

router.post(
  "/",
  formLimiter,
  validate(schema),
  submitNewsletterSubscription
);

router.post(
  "/unsubscribe",
  formLimiter,
  validate(unsubscribeSchema),
  unsubscribeNewsletter
);

export default router;
