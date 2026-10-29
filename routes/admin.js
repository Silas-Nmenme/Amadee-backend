
import { Router } from "express";
import {
  getAdminSummary,
  getAdminSubscribers,
} from "../controllers/adminController.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/auth.js";

const router = Router();

// All admin endpoints require authentication and admin authorization.
router.use(requireAuth, requireAdmin);

// GET /api/admin/summary
router.get("/summary", getAdminSummary);

// GET /api/admin/subscribers
router.get("/subscribers", getAdminSubscribers);

export default router;
