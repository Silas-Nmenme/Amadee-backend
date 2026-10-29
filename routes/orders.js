
import { Router } from "express";

import {
  createOrder,
  getMyOrders,
  getAdminOrders,
  updateOrderStatus,
} from "../controllers/ordersController.js";

import {
  orderSchema,
  orderStatusSchema,
} from "../validators/orderValidator.js";

import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/* CUSTOMER ROUTES                                                            */
/* -------------------------------------------------------------------------- */

// Create an order.
router.post(
  "/",
  formLimiter,
  validate(orderSchema),
  createOrder
);

// Get the authenticated customer's orders.
router.get(
  "/mine",
  requireAuth,
  getMyOrders
);

/* -------------------------------------------------------------------------- */
/* ADMIN ROUTES                                                               */
/* -------------------------------------------------------------------------- */

// List orders with pagination.
router.get(
  "/",
  requireAuth,
  requireAdmin,
  getAdminOrders
);

// Update an order's fulfilment status.
router.patch(
  "/:orderId/status",
  requireAuth,
  requireAdmin,
  validate(orderStatusSchema),
  updateOrderStatus
);

export default router;
