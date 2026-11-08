import { Router } from "express";
import { z } from "zod";
import {
  getAdminMessages,
  getAdminSummary,
  getAdminSubscribers,
  updateAdminMessageHandled,
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
import { validateObjectId } from "../middleware/validateObjectId.js";
import { promoAdminSchema } from "../validators/promoValidator.js";

const router = Router();
const messageStatusSchema = z.object({ handled: z.boolean() }).strict();

// All admin endpoints require authentication and admin authorization.
router.use(requireAuth, requireAdmin);

// GET /api/admin/summary
router.get("/summary", getAdminSummary);

// GET /api/admin/subscribers
router.get("/subscribers", getAdminSubscribers);
router.get("/messages", getAdminMessages);
router.patch(
  "/messages/:messageId/handled",
  validateObjectId("messageId"),
  validate(messageStatusSchema),
  updateAdminMessageHandled
);

router.get("/promos", getAdminPromos);
router.post("/promos", validate(promoAdminSchema), createPromo);
router.patch("/promos/:id", validate(promoAdminSchema), updatePromo);

export default router;
