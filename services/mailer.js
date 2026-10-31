import nodemailer from "nodemailer";

function getTransport() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Email service is not configured. Check SMTP_HOST, SMTP_USER and SMTP_PASS."
    );
  }

  const port = Number(SMTP_PORT) || 587;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure:
      SMTP_SECURE === "true" ||
      (SMTP_SECURE !== "false" && port === 465),

    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}) {
  if (!to || !subject || (!text && !html)) {
    throw new Error(
      "Email requires a recipient, subject and text or HTML content."
    );
  }

  const transport = getTransport();

  try {
    const result = await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent successfully:", {
      to,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    });

    return result;
  } catch (error) {
    console.error("Nodemailer send error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
    });

    throw error;
  } finally {
    transport.close();
  }
}

/**
 * Run this to test SMTP connectivity and authentication.
 */
export async function verifyMailConfiguration() {
  const transport = getTransport();

  try {
    await transport.verify();

    console.log("SMTP connection and authentication verified.");

    return true;
  } catch (error) {
    console.error("SMTP verification failed:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
    });

    throw error;
  } finally {
    transport.close();
  }
}
