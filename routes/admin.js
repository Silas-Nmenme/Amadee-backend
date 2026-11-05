import { Router } from "express";
import {
  getAdminSummary,
  getAdminSubscribers,
} from "../controllers/adminController.js";
import {
  createPromo,
  getAdminPromos,
  updatePromo,
} from "../controllers/promoController.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { promoAdminSchema } from "../validators/promoValidator.js";

const router = Router();

// All admin endpoints require authentication and admin authorization.
router.use(requireAuth, requireAdmin);

// GET /api/admin/summary
router.get("/summary", getAdminSummary);

// GET /api/admin/subscribers
router.get("/subscribers", getAdminSubscribers);

router.get("/promos", getAdminPromos);
router.post("/promos", validate(promoAdminSchema), createPromo);
router.patch("/promos/:id", validate(promoAdminSchema), updatePromo);

export default router;
