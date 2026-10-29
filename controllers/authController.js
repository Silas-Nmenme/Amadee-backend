
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import User from "../models/User.js";
import {
  issueOtp,
  hashOtp,
  safeHashEqual,
} from "../services/otp.js";
import { sendMail } from "../services/mailer.js";
import { passwordResetEmail } from "../templates/emailTemplates.js";

/* =========================================================
   VALIDATION SCHEMAS
========================================================= */

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string()
    .min(10)
    .max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const emailSchema = z.object({
  email: z.string().trim().email().max(254),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().regex(/^\d{6}$/),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().regex(/^\d{6}$/),
  password: z.string()
    .min(10)
    .max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

/* =========================================================
   COMMON HELPERS
========================================================= */

const cookieName =
  process.env.JWT_COOKIE_NAME || "amadee_session";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const otpFields =
  "+verificationOtpHash +verificationOtpExpiresAt +verificationOtpAttempts";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
  };
}

function setSession(res, user) {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters."
    );
  }

  const token = jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      issuer: "amadee-stiches-api",
      audience: "amadee-stiches-web",
    }
  );

  res.cookie(cookieName, token, cookieOptions);
}

function clearSession(res) {
  res.clearCookie(cookieName, clearCookieOptions);
}

/* =========================================================
   SIGNUP
   POST /api/auth/signup
========================================================= */

export async function signup(req, res, next) {
  try {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide valid registration details.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, password } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const adminEmail = normalizeEmail(
      process.env.ADMIN_EMAIL || ""
    );

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role:
        adminEmail && email === adminEmail
          ? "admin"
          : "customer",
      verified: false,
    });

    let otpData;
    try {
      otpData = await issueOtp(email);
    } catch (error) {
      await User.deleteOne({ _id: user._id });

      return res.status(503).json({
        message:
          "Unable to send verification email. Please try again later.",
      });
    }

    // Persist the OTP hash and expiry to the User document so that
    // the verifyOtp controller can look it up from the database.
    user.verificationOtpHash = otpData.hash;
    user.verificationOtpExpiresAt = otpData.expiresAt;
    user.verificationOtpAttempts = 0;
    await user.save();

    return res.status(201).json({
      success: true,
      message: "Registration successful. Verification code sent.",
      email,
      requiresVerification: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
}

/* =========================================================
   VERIFY EMAIL
   POST /api/auth/verify-otp
========================================================= */

export async function verifyOtp(req, res, next) {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a valid email and six-digit code.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const { otp } = parsed.data;

    const user = await User.findOne({ email }).select(otpFields);

    if (
      !user ||
      user.verified ||
      !user.verificationOtpHash ||
      !user.verificationOtpExpiresAt ||
      user.verificationOtpExpiresAt.getTime() < Date.now() ||
      (user.verificationOtpAttempts || 0) >= 5
    ) {
      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    user.verificationOtpAttempts =
      (user.verificationOtpAttempts || 0) + 1;

    const matches = safeHashEqual(
      user.verificationOtpHash,
      hashOtp(otp)
    );

    if (!matches) {
      if (user.verificationOtpAttempts >= 5) {
        user.verificationOtpHash = undefined;
        user.verificationOtpExpiresAt = undefined;
      }

      await user.save();

      return res.status(400).json({
        message: "Invalid or expired verification code.",
      });
    }

    user.verified = true;
    user.verificationOtpHash = undefined;
    user.verificationOtpExpiresAt = undefined;
    user.verificationOtpAttempts = 0;

    await user.save();

    return res.json({
      success: true,
      message: "Email verified successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   RESEND OTP
   POST /api/auth/resend-otp
========================================================= */

export async function resendOtp(req, res, next) {
  try {
    const parsed = emailSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const email = normalizeEmail(parsed.data.email);

    const user = await User.findOne({ email }).select(otpFields);

    if (user && !user.verified) {
      let otpData;
      try {
        otpData = await issueOtp(user.email);
      } catch {
        return res.status(503).json({
          message: "Unable to send verification code right now.",
        });
      }

      // Persist the new OTP hash and expiry to the User document.
      user.verificationOtpHash = otpData.hash;
      user.verificationOtpExpiresAt = otpData.expiresAt;
      user.verificationOtpAttempts = 0;
      await user.save();
    }

    return res.json({
      success: true,
      message:
        "If the account exists and requires verification, a code has been sent.",
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   LOGIN
   POST /api/auth/login
========================================================= */

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide a valid email and password.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const { password } = parsed.data;

    const user = await User.findOne({ email })
      .select("+passwordHash");

    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!user.verified) {
      return res.status(403).json({
        message: "Please verify your email before signing in.",
        requiresVerification: true,
        email: user.email,
      });
    }

    user.lastLoginAt = new Date();

    await user.save();

    setSession(res, user);

    return res.json({
      success: true,
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   CURRENT USER
   GET /api/auth/me
========================================================= */

export async function getMe(req, res) {
  return res.json({
    success: true,
    user: publicUser(req.user),
  });
}

/* =========================================================
   LOGOUT
   POST /api/auth/logout
========================================================= */

export async function logout(req, res) {
  clearSession(res);

  return res.json({
    success: true,
    message: "Signed out successfully.",
  });
}

/* =========================================================
   FORGOT PASSWORD
   POST /api/auth/forgot-password
========================================================= */

export async function forgotPassword(req, res, next) {
  try {
    const parsed = emailSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const email = normalizeEmail(parsed.data.email);

    const user = await User.findOne({ email });

    if (
      user &&
      process.env.PASSWORD_RESET_ENABLED === "true"
    ) {
      const otp = String(randomInt(100000, 1000000));

      user.verificationOtpHash = hashOtp(otp);

      user.verificationOtpExpiresAt = new Date(
        Date.now() + 10 * 60 * 1000
      );

      user.verificationOtpAttempts = 0;

      await user.save();

      try {
        await sendMail({
          to: user.email,
          ...passwordResetEmail({ otp }),
        });
      } catch {
        user.verificationOtpHash = undefined;
        user.verificationOtpExpiresAt = undefined;
        user.verificationOtpAttempts = 0;

        await user.save();

        return res.status(503).json({
          message:
            "Unable to send password reset instructions right now.",
        });
      }
    }

    return res.json({
      success: true,
      message:
        "If the account exists, password reset instructions will be sent.",
    });
  } catch (error) {
    next(error);
  }
}

/* =========================================================
   RESET PASSWORD
   POST /api/auth/reset-password
========================================================= */

export async function resetPassword(req, res, next) {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide valid password reset details.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const { otp, password } = parsed.data;

    const user = await User.findOne({ email }).select(otpFields);

    if (
      !user ||
      !user.verificationOtpHash ||
      !user.verificationOtpExpiresAt ||
      user.verificationOtpExpiresAt.getTime() < Date.now() ||
      (user.verificationOtpAttempts || 0) >= 5
    ) {
      return res.status(400).json({
        message: "Invalid or expired reset code.",
      });
    }

    user.verificationOtpAttempts =
      (user.verificationOtpAttempts || 0) + 1;

    const matches = safeHashEqual(
      user.verificationOtpHash,
      hashOtp(otp)
    );

    if (!matches) {
      if (user.verificationOtpAttempts >= 5) {
        user.verificationOtpHash = undefined;
        user.verificationOtpExpiresAt = undefined;
      }

      await user.save();

      return res.status(400).json({
        message: "Invalid or expired reset code.",
      });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();

    user.verificationOtpHash = undefined;
    user.verificationOtpExpiresAt = undefined;
    user.verificationOtpAttempts = 0;

    await user.save();

    clearSession(res);

    return res.json({
      success: true,
      message: "Password updated. Please sign in again.",
    });
  } catch (error) {
    next(error);
  }
}
