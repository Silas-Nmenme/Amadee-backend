
import {
  randomInt,
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { sendMail } from "./mailer.js";
import { verificationEmail } from "../templates/emailTemplates.js";

/* =========================================================
   OTP STORAGE
========================================================= */

// Temporary in-memory OTP storage.
// Key: normalized email address.
const codes = new Map();

/* =========================================================
   CONFIGURATION
========================================================= */

const ttl = Number(process.env.OTP_TTL_MINUTES) || 5;

const MAX_ATTEMPTS = 3;

/* =========================================================
   HASH OTP
========================================================= */

/**
 * Hash an OTP using SHA-256.
 *
 * @param {string|number} otp
 * @returns {string}
 */
export function hashOtp(otp) {
  return createHash("sha256")
    .update(String(otp).trim())
    .digest("hex");
}

/* =========================================================
   SAFE HASH COMPARISON
========================================================= */

/**
 * Compare two SHA-256 hashes safely.
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
 * @returns {Promise<void>}
 */
export async function issueOtp(email) {
  if (!email || typeof email !== "string") {
    throw new Error(
      "A valid email address is required to issue an OTP."
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const otp = String(randomInt(100000, 1000000));

  const hash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + ttl * 60_000);

  // Store hashed OTP, expiration and attempts.
  codes.set(normalizedEmail, {
    hash,

    expiresAt: expiresAt.getTime(),

    attempts: 0,
  });

  try {
    await sendMail({
      to: normalizedEmail,

      ...verificationEmail({
        name: normalizedEmail,
        otp,
        minutes: ttl,
      }),
    });
  } catch (error) {
    // Remove the OTP if email delivery fails.
    codes.delete(normalizedEmail);

    throw error;
  }

  // Return the hash and expiry so callers can persist them to the database.
  return { hash, expiresAt };
}

/* =========================================================
   VERIFY OTP
========================================================= */

/**
 * Verify an OTP.
 *
 * @param {string} email
 * @param {string|number} otp
 * @returns {boolean}
 */
export function verifyOtp(email, otp) {
  if (
    !email ||
    typeof email !== "string" ||
    otp == null
  ) {
    return false;
  }

  const key = email.toLowerCase().trim();

  const record = codes.get(key);

  if (!record) {
    return false;
  }

  // Reject expired codes.
  if (Date.now() > record.expiresAt) {
    codes.delete(key);

    return false;
  }

  // Count verification attempts.
  record.attempts += 1;

  // Reject after maximum attempts.
  if (record.attempts > MAX_ATTEMPTS) {
    codes.delete(key);

    return false;
  }

  // Hash submitted OTP.
  const submittedHash = hashOtp(otp);

  // Compare hashes.
  const matches = safeHashEqual(
    submittedHash,
    record.hash
  );

  if (!matches) {
    // Remove OTP after maximum attempts.
    if (record.attempts >= MAX_ATTEMPTS) {
      codes.delete(key);
    }

    return false;
  }

  // OTP can only be used once.
  codes.delete(key);

  return true;
}
