
import Message from "../models/Message.js";
import { sendMail } from "../services/mailer.js";

export const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, message, website } = req.validatedBody;

    // Honeypot field: silently accept bot submissions without storing them.
    if (website) {
      return res.status(200).json({
        message: "Message received.",
      });
    }

    if (!process.env.SHOP_OWNER_EMAIL) {
      return res.status(503).json({
        message: "Contact form is temporarily unavailable.",
      });
    }

    // Save the message before attempting email delivery.
    const savedMessage = await Message.create({
      name,
      email: email.toLowerCase(),
      message,
    });

    try {
      await sendMail({
        to: process.env.SHOP_OWNER_EMAIL,
        replyTo: email,
        subject: `Amadee-Stiches contact form: ${name}`,
        text: [
          `From: ${name}`,
          `Email: ${email}`,
          "",
          message,
          "",
          `Message ID: ${savedMessage._id}`,
        ].join("\n"),
      });
    } catch (emailError) {
      // The message is still saved in MongoDB for later review.
      console.error(
        "Contact notification email failed:",
        emailError instanceof Error
          ? emailError.message
          : emailError
      );

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
