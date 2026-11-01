import { Router } from "express";
import { z } from "zod";

import { submitNewsletterSubscription } from "../controllers/newsletterController.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";

const router = Router();
const schema = z.object({
  email: z.string().trim().email().max(254),
  website: z.string().max(200).optional().default(""),
});

router.post(
  "/",
  formLimiter,
  validate(schema),
  submitNewsletterSubscription
);

export default router;
