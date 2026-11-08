import { createHash, randomBytes } from "node:crypto";
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

    if (existing?.active && existing.unsubscribeToken) {
      return res.status(200).json({ message: "You are already subscribed." });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const consentedAt = new Date();

    if (existing) {
      existing.active = true;
      existing.subscribedAt = consentedAt;
      existing.consentedAt = consentedAt;
      existing.consentSource = "storefront";
      existing.unsubscribedAt = null;
      existing.unsubscribeToken = tokenHash;
      await existing.save();
    } else {
      await Subscriber.create({
        email,
        active: true,
        subscribedAt: consentedAt,
        consentedAt,
        consentSource: "storefront",
        unsubscribeToken: tokenHash,
      });
    }

    const notifications = [
      sendBestEffortMail({
        event: "Newsletter welcome",
        to: email,
        ...newsletterWelcomeEmail(email, token),
      }),
    ];
    if (!existing) {
      notifications.push(sendBestEffortMail({
        event: "New newsletter subscriber notification",
        to: process.env.SHOP_OWNER_EMAIL,
        ...newsletterNotificationEmail(email),
      }));
    }
    await Promise.all(notifications);

    return res.status(201).json({ message: "Subscribed." });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ message: "You are already subscribed." });
    }

    return next(error);
  }
}

export async function unsubscribeNewsletter(req, res, next) {
  try {
    const tokenHash = createHash("sha256")
      .update(req.validatedBody.token)
      .digest("hex");
    const subscriber = await Subscriber.findOneAndUpdate(
      { unsubscribeToken: tokenHash, active: true },
      {
        $set: { active: false, unsubscribedAt: new Date() },
        $unset: { unsubscribeToken: 1 },
      },
      { new: true }
    );

    return res.status(200).json({
      message: subscriber
        ? "You have been unsubscribed from collection updates."
        : "This unsubscribe link is invalid or has already been used.",
    });
  } catch (error) {
    return next(error);
  }
}
