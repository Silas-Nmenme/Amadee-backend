import { Router } from "express";

import {
  createOrder,
  getMyOrders,
  getAdminOrders,
  updateOrderStatus,
  createOrderRequest,
  updateOrderTracking,
  reviewOrderRequest,
  confirmOrderRefund,
  confirmManualPayment,
} from "../controllers/ordersController.js";

import {
  orderSchema,
  orderStatusSchema,
  orderRequestSchema,
  reviewOrderRequestSchema,
  trackingSchema,
  refundSchema,
  manualPaymentSchema,
} from "../validators/orderValidator.js";

import { validate } from "../middleware/validate.js";
import { formLimiter } from "../middleware/rateLimit.js";
import {
  requireAuth,
  requireAdmin,
} from "../middleware/auth.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/* CUSTOMER ROUTES                                                            */
/* -------------------------------------------------------------------------- */

// Create an order.
router.post(
  "/",
  formLimiter,
  requireAuth,
  validate(orderSchema),
  createOrder
);

// Get the authenticated customer's orders.
router.get(
  "/mine",
  requireAuth,
  getMyOrders
);

// Submit a cancellation or return request for an owned order.
router.post(
  "/:orderId/requests",
  formLimiter,
  requireAuth,
  validate(orderRequestSchema),
  createOrderRequest
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

router.patch(
  "/:orderId/payment",
  requireAuth,
  requireAdmin,
  validate(manualPaymentSchema),
  confirmManualPayment
);

// Update shipment tracking details.
router.patch(
  "/:orderId/tracking",
  requireAuth,
  requireAdmin,
  validate(trackingSchema),
  updateOrderTracking
);

// Approve or reject a customer cancellation/return request.
router.patch(
  "/:orderId/requests/:requestId",
  requireAuth,
  requireAdmin,
  validate(reviewOrderRequestSchema),
  reviewOrderRequest
);

// Record a refund only after it has been completed manually with the provider.
router.post(
  "/:orderId/requests/:requestId/refund",
  requireAuth,
  requireAdmin,
  validate(refundSchema),
  confirmOrderRefund
);

export default router;
