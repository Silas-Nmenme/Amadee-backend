
import { Router } from "express";

import {
  signup,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* =========================================================
   PUBLIC AUTHENTICATION ROUTES
========================================================= */

// Register account
router.post("/signup", authLimiter, signup);

// Verify email
router.post("/verify-otp", authLimiter, verifyOtp);

// Resend verification code
router.post("/resend-otp", authLimiter, resendOtp);

// Login
router.post("/login", authLimiter, login);

// Forgot password
router.post("/forgot-password", authLimiter, forgotPassword);

// Reset password
router.post("/reset-password", authLimiter, resetPassword);

/* =========================================================
   PROTECTED AUTHENTICATION ROUTES
========================================================= */

// Get logged-in user
router.get("/me", requireAuth, getMe);

// Logout
router.post("/logout", requireAuth, logout);

export default router;
