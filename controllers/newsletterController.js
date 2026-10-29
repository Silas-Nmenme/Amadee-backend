import { Router } from "express";
import { z } from "zod";
import Subscriber from "../models/Subscriber.js";
import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { sendMail } from "../services/mailer.js";

const router = Router();
const schema = z.object({ email: z.string().trim().email().max(254), website: z.string().max(200).optional().default("") });
router.post("/", formLimiter, validate(schema), async (req, res, next) => {
  try {
    const { website } = req.validatedBody;
    const email = req.validatedBody.email.toLowerCase();
    if (website) return res.json({ message: "Subscription received." });
    const existing = await Subscriber.findOne({ email });
    if (existing?.active) return res.json({ message: "You are already subscribed." });
    if (existing) { existing.active = true; existing.subscribedAt = new Date(); await existing.save(); }
    else await Subscriber.create({ email });
    if (process.env.SHOP_OWNER_EMAIL) {
      try { await sendMail({ to: process.env.SHOP_OWNER_EMAIL, subject: "New Amadee-Stiches newsletter subscriber", text: `Subscriber: ${email}` }); }
      catch (err) { console.error("Newsletter notification failed:", err.message); }
    }
    res.status(201).json({ message: "Subscribed." });
  } catch (err) {
    if (err?.code === 11000) return res.json({ message: "You are already subscribed." });
    next(err);
  }
});
export default router;
