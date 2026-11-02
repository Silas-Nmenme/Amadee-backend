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
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,

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
  replyTo,
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
      ...(replyTo ? { replyTo } : {}),
    });

    if (
      result.rejected?.length ||
      (Array.isArray(result.accepted) && result.accepted.length === 0)
    ) {
      throw new Error("SMTP server did not accept the email recipient.");
    }

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

export async function sendBestEffortMail({ event, ...message }) {
  try {
    await sendMail(message);
    return true;
  } catch (error) {
    console.error(
      `${event || "Notification"} email failed:`,
      error instanceof Error ? error.message : error
    );
    return false;
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
