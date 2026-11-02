import Subscriber from "../models/Subscriber.js";
import { sendBestEffortMail } from "../services/mailer.js";
import {
  newsletterNotificationEmail,
  newsletterWelcomeEmail,
} from "../templates/emailTemplates.js";

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

    const notifications = [
      sendBestEffortMail({
        event: "Newsletter welcome",
        to: email,
        ...newsletterWelcomeEmail(email),
      }),
      sendBestEffortMail({
        event: "New newsletter subscriber notification",
        to: process.env.SHOP_OWNER_EMAIL,
        ...newsletterNotificationEmail(email),
      }),
    ];
    await Promise.all(notifications);

    return res.status(201).json({ message: "Subscribed." });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ message: "You are already subscribed." });
    }

    return next(error);
  }
}
