import {
  randomInt,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { sendMail } from "./mailer.js";
import { verificationEmail } from "../templates/emailTemplates.js";

/* =========================================================
   CONFIGURATION
========================================================= */

const ttl = Number(process.env.OTP_TTL_MINUTES) || 5;

/* =========================================================
   HASH OTP
========================================================= */

/**
 * Hash an OTP with a server-held key so database-only disclosures do not
 * allow offline enumeration of the six-digit code.
 *
 * @param {string|number} otp
 * @returns {string}
 */
export function hashOtp(otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OTP_SECRET or a 32-character JWT_SECRET must be configured.");
  }

  return createHmac("sha256", secret)
    .update(`amadee-otp:${String(otp).trim()}`)
    .digest("hex");
}

/* =========================================================
   SAFE HASH COMPARISON
========================================================= */

/**
 * Compare two keyed OTP hashes safely.
 *
 * @param {string} hash1
 * @param {string} hash2
 * @returns {boolean}
 */
export function safeHashEqual(hash1, hash2) {
  if (
    typeof hash1 !== "string" ||
    typeof hash2 !== "string"
  ) {
    return false;
  }

  if (
    !/^[a-f0-9]{64}$/i.test(hash1) ||
    !/^[a-f0-9]{64}$/i.test(hash2)
  ) {
    return false;
  }

  const buffer1 = Buffer.from(hash1, "hex");
  const buffer2 = Buffer.from(hash2, "hex");

  if (buffer1.length !== buffer2.length) {
    return false;
  }

  return timingSafeEqual(buffer1, buffer2);
}

/* =========================================================
   ISSUE OTP
========================================================= */

/**
 * Generate and email a verification OTP.
 *
 * @param {string} email
 * @returns {Promise<{hash: string, expiresAt: Date}>}
 */
export async function issueOtp(email, name = email) {
  if (!email || typeof email !== "string") {
    throw new Error(
      "A valid email address is required to issue an OTP."
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const otp = String(randomInt(100000, 1000000));

  const hash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + ttl * 60_000);

  await sendMail({
    to: normalizedEmail,
    ...verificationEmail({
      name,
      otp,
      minutes: ttl,
    }),
  });

  // Return the hash and expiry so callers can persist them to the database.
  return { hash, expiresAt };
}
