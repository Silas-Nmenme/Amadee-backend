import { Router } from "express";

import {
  signup,
  registerAdmin,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  updateMe,
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

// Bootstrap the single administrator allowlisted by ADMIN_EMAIL.
router.post("/register-admin", authLimiter, registerAdmin);

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
router.patch("/me", requireAuth, updateMe);

// Logout
router.post("/logout", requireAuth, logout);

export default router;
