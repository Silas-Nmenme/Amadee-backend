import { createHmac, timingSafeEqual } from "node:crypto";

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { sendMail } from "../services/mailer.js";
import { paymentConfirmedEmail } from "../templates/emailTemplates.js";

const PAYSTACK_API = "https://api.paystack.co";

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    throw httpError("Online payment is not configured.", 503);
  }

  return secret;
}

async function paystackRequest(path, options = {}) {
  const secret = getPaystackSecret();

  let response;

  try {
    response = await fetch(`${PAYSTACK_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Paystack connection failed:", error?.message || error);
    throw httpError("Could not connect to the payment provider.", 502);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.status) {
    console.error("Paystack API request failed:", {
      status: response.status,
      message: result.message,
    });

    throw httpError("Could not complete the payment request.", 502);
  }

  return result.data;
}

/**
 * Validate the Paystack signature using the original request body.
 */
function validSignature(req) {
  const secret = getPaystackSecret();
  const signature = req.get("x-paystack-signature");
  const rawBody = req.rawBody;

  if (
    typeof signature !== "string" ||
    !/^[a-f\d]{128}$/i.test(signature) ||
    !Buffer.isBuffer(rawBody)
  ) {
    return false;
  }

  const expected = createHmac("sha512", secret)
    .update(rawBody)
    .digest();

  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length &&
    timingSafeEqual(expected, received)
  );
}

async function verifyPaystackTransaction(reference) {
  if (
    typeof reference !== "string" ||
    !reference.trim() ||
    reference.length > 200
  ) {
    throw httpError("Invalid payment reference.");
  }

  return paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" }
  );
}

function transactionMatchesOrder(order, transaction, reference) {
  const savedReferences = order.paymentReferences || [];

  const referenceMatches =
    transaction.reference === reference &&
    (
      reference === order.orderId ||
      reference === order.paymentReference ||
      savedReferences.includes(reference)
    );

  return (
    order.paymentMethod === "paystack" &&
    referenceMatches &&
    transaction.status === "success" &&
    transaction.currency === "NGN" &&
    Number(transaction.amount) === Math.round(order.total * 100)
  );
}

/**
 * Send the existing payment-confirmation email.
 * Email errors should not reverse an otherwise successful payment.
 */
async function sendPaymentConfirmation(order) {
  if (!order?.customer?.email) return;

  try {
    await sendMail({
      to: order.customer.email,
      ...paymentConfirmedEmail(order),
    });
  } catch (error) {
    console.error(
      "Payment confirmation email failed:",
      error?.message || error
    );
  }
}

/**
 * Mark an order paid and deduct stock exactly once during normal
 * concurrent webhook/verification processing.
 *
 * Order schema must include:
 * - inventoryProcessingAt: Date
 * - inventoryDeductedAt: Date
 *
 * Multi-document stock updates are not atomic here. For stronger
 * crash recovery, use a MongoDB transaction and/or inventory ledger.
 */
async function markOrderPaidAndDeductInventory(order, transaction) {
  if (order.paymentStatus === "paid" || order.inventoryDeductedAt) {
    return {
      alreadyProcessed: true,
      order,
    };
  }

  const claim = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: { $ne: "paid" },
      inventoryDeductedAt: { $exists: false },
      inventoryProcessingAt: { $exists: false },
    },
    {
      $set: { inventoryProcessingAt: new Date() },
    },
    { new: true }
  );

  if (!claim) {
    const latest = await Order.findById(order._id).lean();

    if (latest?.paymentStatus === "paid" || latest?.inventoryDeductedAt) {
      return {
        alreadyProcessed: true,
        order: latest,
      };
    }

    return { processing: true };
  }

  const quantities = new Map();

  for (const item of order.items || []) {
    const productCode = String(item.productId).toUpperCase();

    quantities.set(
      productCode,
      (quantities.get(productCode) || 0) + Number(item.quantity)
    );
  }

  const deducted = [];

  try {
    for (const [productCode, quantity] of quantities) {
      const product = await Product.findOneAndUpdate(
        {
          productCode,
          stock: { $gte: quantity },
        },
        {
          $inc: { stock: -quantity },
        },
        { new: true }
      );

      if (!product) {
        throw httpError(
          `Payment succeeded, but stock for ${productCode} is insufficient. Manual fulfilment review is required.`,
          409
        );
      }

      deducted.push({ productCode, quantity });
    }

    const paidAt = transaction.paid_at
      ? new Date(transaction.paid_at)
      : new Date();

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: { $ne: "paid" },
        inventoryProcessingAt: { $exists: true },
      },
      {
        $set: {
          paymentStatus: "paid",
          paidAt,
          paymentChannel: String(transaction.channel || ""),
          inventoryDeductedAt: new Date(),
        },
        $unset: {
          inventoryProcessingAt: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedOrder) {
      throw new Error(
        `Could not finalize paid order ${order.orderId}. Inventory reconciliation is required.`
      );
    }

    // This email is sent only by the request that finalizes the order.
    await sendPaymentConfirmation(updatedOrder);

    return {
      alreadyProcessed: false,
      order: updatedOrder,
    };
  } catch (error) {
    // Best-effort rollback if inventory was deducted but finalization failed.
    for (const item of [...deducted].reverse()) {
      try {
        await Product.updateOne(
          { productCode: item.productCode },
          { $inc: { stock: item.quantity } }
        );
      } catch (rollbackError) {
        console.error("Inventory rollback failed:", {
          orderId: order.orderId,
          productCode: item.productCode,
          error: rollbackError?.message || rollbackError,
        });
      }
    }

    await Order.updateOne(
      {
        _id: order._id,
        paymentStatus: { $ne: "paid" },
      },
      {
        $unset: { inventoryProcessingAt: 1 },
      }
    ).catch((cleanupError) => {
      console.error(
        "Could not clear inventory processing marker:",
        cleanupError?.message || cleanupError
      );
    });

    throw error;
  }
}

/**
 * Load the order, independently verify the transaction with Paystack,
 * validate the amount/currency/reference, and finalize payment.
 */
async function confirmPayment(reference) {
  if (
    typeof reference !== "string" ||
    !reference.trim() ||
    reference.length > 200
  ) {
    throw httpError("Invalid payment reference.");
  }

  const order = await Order.findOne({
    $or: [
      { orderId: reference },
      { paymentReference: reference },
      { paymentReferences: reference },
    ],
  });

  if (!order) {
    throw httpError("Order for this payment reference was not found.", 404);
  }

  if (order.paymentMethod !== "paystack") {
    throw httpError("This order does not use Paystack.", 400);
  }

  const transaction = await verifyPaystackTransaction(reference);

  if (!transactionMatchesOrder(order, transaction, reference)) {
    throw httpError(
      "Payment could not be verified against this order.",
      400
    );
  }

  return markOrderPaidAndDeductInventory(order, transaction);
}

/* -------------------------------------------------------------------------- */
/* POST /api/payments/initialize                                              */
/* Body: { orderId, email }                                                   */
/* -------------------------------------------------------------------------- */

export async function initializePayment(req, res, next) {
  try {
    const { orderId, email } = req.body || {};

    if (
      typeof orderId !== "string" ||
      !orderId.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      throw httpError("A valid orderId and customer email are required.");
    }

    const order = await Order.findOne({
      orderId: orderId.trim(),
      "customer.email": email.trim().toLowerCase(),
    });

    if (!order) {
      throw httpError("Order not found.", 404);
    }

    if (order.paymentMethod !== "paystack") {
      throw httpError("This order does not use Paystack.", 400);
    }

    if (order.paymentStatus === "paid") {
      return res.status(409).json({
        message: "This order has already been paid.",
      });
    }

    if (order.paymentReference) {
      return res.status(409).json({
        message:
          "A payment reference already exists. Verify the existing payment instead of initializing another transaction.",
        orderId: order.orderId,
        reference: order.paymentReference,
      });
    }

    const payload = {
      email: order.customer.email,
      amount: Math.round(order.total * 100),
      currency: "NGN",
      reference: order.orderId,
      metadata: {
        orderId: order.orderId,
        customerName: order.customer.name,
      },
      ...(process.env.PAYSTACK_CALLBACK_URL
        ? { callback_url: process.env.PAYSTACK_CALLBACK_URL }
        : {}),
    };

    const result = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!result?.authorization_url || !result?.reference) {
      throw httpError("Paystack returned an incomplete payment response.", 502);
    }

    order.paymentReference = result.reference;
    await order.save();

    return res.status(201).json({
      orderId: order.orderId,
      reference: result.reference,
      authorizationUrl: result.authorization_url,
      message: "Payment initialized successfully.",
    });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/payments/verify/:reference                                        */
/* -------------------------------------------------------------------------- */

export async function verifyPayment(req, res, next) {
  try {
    const result = await confirmPayment(req.params.reference);

    if (result.processing) {
      return res.status(202).json({
        verified: false,
        paymentStatus: "pending",
        message: "Payment is being processed. Please check again shortly.",
      });
    }

    const order = result.order;

    return res.status(200).json({
      verified: order?.paymentStatus === "paid",
      alreadyProcessed: result.alreadyProcessed,
      order: order
        ? {
            orderId: order.orderId,
            total: order.total,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            paymentChannel: order.paymentChannel,
          }
        : null,
      message: "Payment verified successfully.",
    });
  } catch (error) {
    next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* POST /api/payments/paystack/webhook                                        */
/* -------------------------------------------------------------------------- */

export async function paystackWebhook(req, res, next) {
  try {
    if (!validSignature(req)) {
      return res.status(401).json({
        message: "Invalid Paystack webhook signature.",
      });
    }

    const event = req.body;

    // Acknowledge unrelated events after their signatures have been checked.
    if (event?.event !== "charge.success") {
      return res.sendStatus(200);
    }

    const reference = event?.data?.reference;

    if (typeof reference !== "string" || !reference) {
      return res.status(400).json({
        message: "Webhook payment reference is missing.",
      });
    }

    try {
      const result = await confirmPayment(reference);

      if (result.processing) {
        return res.status(503).json({
          message: "Payment is still being processed. Retry the webhook.",
        });
      }

      return res.sendStatus(200);
    } catch (error) {
      // A webhook for an unknown order will not become valid by retrying.
      if (error?.status === 404) {
        console.warn("Paystack webhook received for an unknown order:", reference);
        return res.sendStatus(200);
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "Paystack webhook processing failed:",
      error?.message || error
    );

    // Non-2xx responses allow Paystack to retry transient failures.
    if (error?.status === 503) {
      return res.status(503).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Webhook processing failed. Paystack may retry the event.",
    });
  }
}
