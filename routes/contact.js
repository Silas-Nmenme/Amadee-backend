
import { Router } from "express";
import { z } from "zod";

import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { submitContactMessage } from "../controllers/contactController.js";

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(200).optional().default(""),
});

router.post(
  "/",
  formLimiter,
  validate(contactSchema),
  submitContactMessage
);

export default router;
