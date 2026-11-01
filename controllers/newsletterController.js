import Subscriber from "../models/Subscriber.js";
import { sendMail } from "../services/mailer.js";

export async function submitNewsletterSubscription(req, res, next) {
  try {
    const { email: submittedEmail, website } = req.validatedBody;

    if (website) {
      return res.status(200).json({ message: "Subscription received." });
    }

    const email = submittedEmail.toLowerCase();
    const existing = await Subscriber.findOne({ email });

    if (existing?.active) {
      return res.status(200).json({ message: "You are already subscribed." });
    }

    if (existing) {
      existing.active = true;
      existing.subscribedAt = new Date();
      await existing.save();
    } else {
      await Subscriber.create({ email });
    }

    if (process.env.SHOP_OWNER_EMAIL) {
      try {
        await sendMail({
          to: process.env.SHOP_OWNER_EMAIL,
          subject: "New Amadee-Stiches newsletter subscriber",
          text: `Subscriber: ${email}`,
        });
      } catch (error) {
        console.error(
          "Newsletter notification failed:",
          error instanceof Error ? error.message : error
        );
      }
    }

    return res.status(201).json({ message: "Subscribed." });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ message: "You are already subscribed." });
    }

    return next(error);
  }
}
