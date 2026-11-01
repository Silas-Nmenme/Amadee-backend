import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =========================================================
   AUTHENTICATION MIDDLEWARE
   Checks whether the user has a valid JWT session.
========================================================= */

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Support Authorization: Bearer <token>
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    // Support both the previous cookie and the supplied cookie
    const cookieName =
      process.env.JWT_COOKIE_NAME || "amadee_session";

    const token =
      req.cookies?.[cookieName] ||
      req.cookies?.token ||
      bearerToken;

    // No authentication token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Support different JWT user ID formats
    const userId =
      typeof decoded === "object" && decoded !== null
        ? decoded.id ||
          decoded.userId ||
          decoded._id ||
          decoded.sub
        : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Find authenticated user
    const user = await User.findById(userId)
      .select("-passwordHash +sessionVersion");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (
      Number(decoded.sessionVersion || 0) !==
      Number(user.sessionVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    // Attach authenticated user to request
    req.user = user;

    next();
  } catch (error) {
    // Invalid or expired JWT
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    next(error);
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const cookieName = process.env.JWT_COOKIE_NAME || "amadee_session";
  const token =
    req.cookies?.[cookieName] ||
    req.cookies?.token ||
    bearerToken;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId =
      typeof decoded === "object" && decoded !== null
        ? decoded.id || decoded.userId || decoded._id || decoded.sub
        : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(userId)
      .select("-passwordHash +sessionVersion");

    if (
      !user ||
      Number(decoded.sessionVersion || 0) !==
        Number(user.sessionVersion || 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }
    return next(error);
  }
};

/* =========================================================
   ADMIN AUTHORIZATION MIDDLEWARE
   Requires requireAuth to run first.
========================================================= */

export const requireAdmin = (req, res, next) => {
  // User must be authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  // User must have admin role
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  next();
};
