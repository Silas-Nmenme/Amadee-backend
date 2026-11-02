import Message from "../models/Message.js";
import { sendBestEffortMail } from "../services/mailer.js";
import { contactNotificationEmail } from "../templates/emailTemplates.js";

export const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, message, website } = req.validatedBody;

    // Honeypot field: silently accept bot submissions without storing them.
    if (website) {
      return res.status(200).json({
        message: "Message received.",
      });
    }

    // Save the message before attempting email delivery.
    const savedMessage = await Message.create({
      name,
      email: email.toLowerCase(),
      message,
    });

    const notified = await sendBestEffortMail({
      event: "Contact enquiry notification",
      to: process.env.SHOP_OWNER_EMAIL,
      ...contactNotificationEmail({
        name,
        email,
        message,
        messageId: String(savedMessage._id),
      }),
    });
    if (!notified) {
      return res.status(202).json({
        message:
          "Your message was received, but email notification is delayed.",
      });
    }

    return res.status(201).json({
      message: "Message sent successfully.",
    });
  } catch (err) {
    next(err);
  }
};
