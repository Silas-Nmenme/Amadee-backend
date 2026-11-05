import { randomUUID } from "node:crypto";

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { calculatePromoDiscount, findUsablePromo, releasePromoUse, reservePromoUse } from "../services/promoService.js";
import User from "../models/User.js";
import { sendBestEffortMail } from "../services/mailer.js";
import {
  adminNewOrderEmail,
  orderRequestEmail,
  orderReceivedEmail,
  orderStatusEmail,
  orderTrackingEmail,
} from "../templates/emailTemplates.js";

const deliveryFees = {
  pickup: 0,
  lagos: 2000,
  outside: 5000,
};

function createHttpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function numericMeasurement(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 1 || number > 300) {
    throw createHttpError(
      "Measurements must be between 1 and 300 cm."
    );
  }

  return number;
}

function normalizeMeasurements(input = {}) {
  return {
    bustChest: numericMeasurement(input.bustChest),
    waist: numericMeasurement(input.waist),
    hip: numericMeasurement(input.hip),
    length: numericMeasurement(input.length),
    notes: input.notes || "",
  };
}

async function notifyOwner(order) {
  await sendBestEffortMail({
    event: "New order notification",
    to: process.env.SHOP_OWNER_EMAIL,
    ...adminNewOrderEmail(order),
  });
}

async function notifyCustomer(order) {
  if (!order.customer?.email) return;

  await sendBestEffortMail({
    event: "Customer order confirmation",
    to: order.customer.email,
    ...orderReceivedEmail(order),
  });
}

async function notifyOrderParties(order) {
  await Promise.all([notifyCustomer(order), notifyOwner(order)]);
}

async function notifyOrderCustomer(order, event, template) {
  if (!order.customer?.email) return;
  await sendBestEffortMail({
    event,
    to: order.customer.email,
    ...template,
  });
}

/* -------------------------------------------------------------------------- */
/* CREATE ORDER                                                               */
/* POST /api/orders                                                           */
/* -------------------------------------------------------------------------- */

export async function createOrder(req, res, next) {
  try {
    const body = req.validatedBody;

    // Check payment configuration before creating an order.
    if (
      body.paymentMethod === "paystack" &&
      !process.env.PAYSTACK_SECRET_KEY
    ) {
      return res.status(503).json({
        message:
          "Online payment is not configured. Choose bank transfer or pay on delivery.",
      });
    }

    // Merge identical product/size/colour combinations.
    const itemMap = new Map();

    for (const item of body.items) {
      const productId = item.productId.toUpperCase();
      const size = item.size?.trim() || "";
      const colour = item.colour?.trim() || "";

      const key = [
        productId,
        size.toLowerCase(),
        colour.toLowerCase(),
      ].join("|");

      const previous = itemMap.get(key);
      const combinedQuantity = (previous?.quantity || 0) + item.quantity;

      if (combinedQuantity > 20) {
        throw createHttpError(
          `The maximum quantity for ${productId} in one cart line is 20.`
        );
      }

      itemMap.set(key, {
        productId,
        size,
        colour,
        quantity: combinedQuantity,
      });
    }

    const requestedItems = [...itemMap.values()];

    // Retrieve the active products and prices from MongoDB.
    const productCodes = [
      ...new Set(requestedItems.map((item) => item.productId)),
    ];

    const products = await Product.find({
      productCode: { $in: productCodes },
      active: true,
    }).lean();

    const productMap = new Map(
      products.map((product) => [product.productCode, product])
    );

    const requestedByProduct = new Map();

    // Validate products, variants, and combined quantities.
    for (const item of requestedItems) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw createHttpError(
          `Product "${item.productId}" is unavailable or does not exist.`
        );
      }

      if (
        item.size &&
        product.sizes?.length > 0 &&
        !product.sizes.some(
          (size) => size.toLowerCase() === item.size.toLowerCase()
        )
      ) {
        throw createHttpError(
          `Size "${item.size}" is unavailable for ${product.name}.`
        );
      }

      if (
        item.colour &&
        product.colours?.length > 0 &&
        !product.colours.some(
          (colour) => colour.toLowerCase() === item.colour.toLowerCase()
        )
      ) {
        throw createHttpError(
          `Colour "${item.colour}" is unavailable for ${product.name}.`
        );
      }

      const totalRequested =
        (requestedByProduct.get(item.productId) || 0) + item.quantity;

      requestedByProduct.set(item.productId, totalRequested);

      if (totalRequested > product.stock) {
        throw createHttpError(
          `Insufficient stock for ${product.name}. Available stock: ${product.stock}.`
        );
      }
    }

    // Calculate all prices on the server.
    let subtotal = 0;

    const items = requestedItems.map((item) => {
      const product = productMap.get(item.productId);
      const unitPrice = product.price;
      const lineTotal = unitPrice * item.quantity;

      subtotal += lineTotal;

      return {
        productId: product.productCode,
        name: product.name,
        unitPrice,
        quantity: item.quantity,
        size: item.size,
        colour: item.colour,
        lineTotal,
      };
    });

    const promoCode = body.promoCode.toUpperCase();
    let discount = 0;
    let promo = null;

    if (promoCode) {
      promo = await findUsablePromo(promoCode, req.user._id);
      discount = calculatePromoDiscount(promo, items, subtotal).discount;
    }

    const deliveryFee = deliveryFees[body.deliveryOption];
    const total = Math.max(0, subtotal - discount + deliveryFee);

    const orderId = `AS-${Date.now()
      .toString(36)
      .toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const measurements = normalizeMeasurements(body.measurements);
    const customer = {
      ...body.customer,
      name: req.user.name,
      email: req.user.email,
    };

    if (promo) await reservePromoUse(promo, req.user._id);

    let order;
    try {
      // Save the order before initializing Paystack so the transaction
      // reference can be associated with a persistent order.
      order = await Order.create({
        orderId,
        user: req.user._id,
        customer,
        items,
        deliveryOption: body.deliveryOption,
        measurements,
        promoCode,
        promoCampaignName: promo?.name || promo?.code || "",
        subtotal,
        discount,
        deliveryFee,
        total,
        paymentMethod: body.paymentMethod,
        paymentStatus: "pending",
        orderStatus: "received",
      });
    } catch (error) {
      if (promo) {
        try {
          await releasePromoUse(promo._id, req.user._id);
        } catch (releaseError) {
          console.error("Could not release promo after order creation failed:", releaseError);
        }
      }
      throw error;
    }

    // Initialize Paystack for online payments.
    if (body.paymentMethod === "paystack") {
      let response;
      let result;

      try {
        response = await fetch(
          "https://api.paystack.co/transaction/initialize",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: order.customer.email,
              amount: Math.round(order.total * 100),
              currency: "NGN",
              reference: order.orderId,
              ...(process.env.PAYSTACK_CALLBACK_URL
                ? { callback_url: process.env.PAYSTACK_CALLBACK_URL }
                : {}),
              metadata: {
                orderId: order.orderId,
                customerName: order.customer.name,
                custom_fields: [
                  {
                    display_name: "Order reference",
                    variable_name: "order_reference",
                    value: order.orderId,
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(12000),
          }
        );

        result = await response.json().catch(() => ({}));
      } catch (error) {
        // The request may have timed out after Paystack received it.
        // Keep the order for investigation instead of deleting it.
        console.error(
          "Paystack initialization request failed:",
          error instanceof Error ? error.message : error
        );

        return res.status(502).json({
          orderId: order.orderId,
          message:
            "We could not confirm the payment initialization response. Contact the shop before retrying to avoid duplicate orders.",
        });
      }

      if (
        !response.ok ||
        !result.status ||
        !result.data?.authorization_url ||
        !result.data?.reference
      ) {
        order.paymentStatus = "failed";
        await order.save();

        return res.status(502).json({
          orderId: order.orderId,
          message:
            "Paystack could not initialize this payment. Contact the shop or choose another payment method.",
        });
      }

      order.paymentReference = result.data.reference;
      await order.save();

      await clearCustomerCart(req.user._id);
      await notifyOrderParties(order);

      return res.status(201).json({
        orderId: order.orderId,
        subtotal,
        discount,
        deliveryFee,
        total,
        currency: "NGN",
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        authorizationUrl: result.data.authorization_url,
        message:
          "Order received. Complete payment on Paystack to confirm it.",
      });
    }

    // Bank transfer and pay-on-delivery orders remain unpaid.
    await clearCustomerCart(req.user._id);
    await notifyOrderParties(order);

    return res.status(201).json({
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      subtotal,
      discount,
      deliveryFee,
      total,
      currency: "NGN",
      paymentMethod: order.paymentMethod,
      message:
        body.paymentMethod === "bank_transfer"
          ? "Order received. Contact the shop for bank-transfer details. Payment is not yet confirmed."
          : "Order received. The shop will contact you to confirm.",
    });
  } catch (error) {
    return next(error);
  }
}

async function clearCustomerCart(userId) {
  try {
    await User.updateOne({ _id: userId }, { $set: { cartItems: [] } });
  } catch (error) {
    console.error("Could not clear cart after order:", {
      message: error instanceof Error ? error.message : error,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* CUSTOMER ORDER HISTORY                                                     */
/* GET /api/orders/mine                                                       */
/* -------------------------------------------------------------------------- */

export async function getMyOrders(req, res, next) {
  try {
    if (!req.user?._id) {
      throw createHttpError("Unable to identify the authenticated user.", 401);
    }

    const orders = await Order.find({ user: req.user._id })
      .select(
        "orderId items promoCode promoCampaignName subtotal discount deliveryOption deliveryFee total paymentMethod paymentStatus paymentReference orderStatus statusHistory tracking orderRequests refundReference createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const productCodes = [
      ...new Set(orders.flatMap(order => (order.items || []).map(item => item.productId))),
    ];
    const products = productCodes.length
      ? await Product.find({ productCode: { $in: productCodes } })
        .select("productCode images")
        .lean()
      : [];
    const imageByProductCode = new Map(
      products.map(product => [product.productCode, product.images?.[0] || ""])
    );
    const ordersWithImages = orders.map(order => ({
      ...order,
      items: (order.items || []).map(item => ({
        ...item,
        image: imageByProductCode.get(item.productId) || "",
      })),
    }));

    return res.status(200).json({ orders: ordersWithImages });
  } catch (error) {
    return next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* ADMIN ORDER LIST                                                           */
/* GET /api/orders                                                            */
/* -------------------------------------------------------------------------- */

export async function getAdminOrders(req, res, next) {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.min(requestedPage, 10000)
        : 1;

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 25;

    const [orders, total] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(),
    ]);
    const productCodes = [
      ...new Set(orders.flatMap(order => (order.items || []).map(item => item.productId))),
    ];
    const products = productCodes.length
      ? await Product.find({ productCode: { $in: productCodes } })
        .select("productCode images")
        .lean()
      : [];
    const imageByProductCode = new Map(
      products.map(product => [product.productCode, product.images?.[0] || ""])
    );
    const ordersWithImages = orders.map(order => ({
      ...order,
      items: (order.items || []).map(item => ({
        ...item,
        image: imageByProductCode.get(item.productId) || "",
      })),
    }));

    return res.status(200).json({
      orders: ordersWithImages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
}

/* -------------------------------------------------------------------------- */
/* UPDATE ORDER STATUS                                                        */
/* PATCH /api/orders/:orderId/status                                          */
/* -------------------------------------------------------------------------- */

export async function updateOrderStatus(req, res, next) {
  try {
    const { orderStatus } = req.validatedBody;

    const order = await Order.findOneAndUpdate(
      {
        orderId: req.params.orderId,
        orderStatus: { $ne: orderStatus },
      },
      {
        $set: { orderStatus },
        $push: {
          statusHistory: {
            status: orderStatus,
            note: `Order status changed to ${orderStatus}.`,
            at: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!order) {
      const existingOrder = await Order.findOne({
        orderId: req.params.orderId,
      });

      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found." });
      }

      return res.status(200).json({
        order: existingOrder,
        message: "Order already has this status.",
      });
    }

    if (order.customer?.email) {
      await sendBestEffortMail({
        event: "Order status update",
        to: order.customer.email,
        ...orderStatusEmail({ order, status: order.orderStatus }),
      });
    }

    return res.status(200).json({
      order,
      message: "Order status updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

      /* -------------------------------------------------------------------------- */
      /* CUSTOMER ORDER REQUEST                                                     */
      /* POST /api/orders/:orderId/requests                                         */
      /* -------------------------------------------------------------------------- */

      export async function createOrderRequest(req, res, next) {
        try {
          const { type, reason } = req.validatedBody;
          const eligibleStatuses = type === "cancellation"
            ? ["received", "confirmed", "in_production", "ready"]
            : ["completed"];
          const now = new Date();
          const order = await Order.findOneAndUpdate(
            {
              orderId: req.params.orderId,
              user: req.user._id,
              orderStatus: { $in: eligibleStatuses },
              $nor: [
                { orderRequests: { $elemMatch: { status: "pending" } } },
                {
                  orderRequests: {
                    $elemMatch: {
                      type,
                      status: { $in: ["approved", "refunded"] },
                    },
                  },
                },
              ],
            },
            {
              $push: {
                orderRequests: { type, reason, status: "pending", requestedAt: now },
              },
            },
            { new: true, runValidators: true }
          );

          if (!order) {
            const existing = await Order.findOne({
              orderId: req.params.orderId,
              user: req.user._id,
            }).select("orderStatus orderRequests");
            if (!existing) throw createHttpError("Order not found.", 404);
            if (existing.orderRequests?.some(request => request.status === "pending")) {
              throw createHttpError("A request is already awaiting review for this order.", 409);
            }
            if (existing.orderRequests?.some(request =>
              request.type === type && ["approved", "refunded"].includes(request.status)
            )) {
              throw createHttpError(`A ${type} request has already been approved for this order.`, 409);
            }
            throw createHttpError(
              type === "cancellation"
                ? "This order can no longer be cancelled. Contact the shop for assistance."
                : "A return request can only be made after an order is completed."
            );
          }

          const request = order.orderRequests.at(-1);
          await sendBestEffortMail({
            event: "New order request notification",
            to: process.env.SHOP_OWNER_EMAIL,
            ...orderRequestEmail({ order, request, audience: "admin" }),
          });
          await sendBestEffortMail({
            event: "Customer order request confirmation",
            to: order.customer.email,
            ...orderRequestEmail({ order, request, audience: "customer" }),
          });

          return res.status(201).json({
            order,
            request,
            message: "Your request has been sent to the shop for review.",
          });
        } catch (error) {
          return next(error);
        }
      }

      /* -------------------------------------------------------------------------- */
      /* ADMIN ORDER TRACKING                                                      */
      /* PATCH /api/orders/:orderId/tracking                                        */
      /* -------------------------------------------------------------------------- */

      export async function updateOrderTracking(req, res, next) {
        try {
          const order = await Order.findOne({ orderId: req.params.orderId });
          if (!order) throw createHttpError("Order not found.", 404);

          const tracking = req.validatedBody;
          const updatedAt = new Date();
          const trackingChanged = Object.entries(tracking)
            .some(([field, value]) => order.tracking?.[field] !== value);
          if (!trackingChanged) {
            return res.status(200).json({ order, message: "Tracking details are unchanged." });
          }

          order.tracking = { ...tracking, updatedAt };
          const note = tracking.note || [
            tracking.carrier && `Carrier: ${tracking.carrier}`,
            tracking.trackingNumber && `Tracking number: ${tracking.trackingNumber}`,
            tracking.trackingUrl && `Tracking link: ${tracking.trackingUrl}`,
          ].filter(Boolean).join(" · ") || "Shipment tracking details updated.";
          order.statusHistory.push({
            status: order.orderStatus,
            note,
            at: updatedAt,
          });
          await order.save();

          await notifyOrderCustomer(
            order,
            "Shipment tracking update",
            orderTrackingEmail(order)
          );

          return res.status(200).json({
            order,
            message: "Tracking details updated and the customer was notified.",
          });
        } catch (error) {
          return next(error);
        }
      }

      /* -------------------------------------------------------------------------- */
      /* ADMIN REVIEW OF CUSTOMER ORDER REQUEST                                     */
      /* PATCH /api/orders/:orderId/requests/:requestId                             */
      /* -------------------------------------------------------------------------- */

      export async function reviewOrderRequest(req, res, next) {
        try {
          const order = await Order.findOne({ orderId: req.params.orderId });
          if (!order) throw createHttpError("Order not found.", 404);

          const request = order.orderRequests.id(req.params.requestId);
          if (!request) throw createHttpError("Order request not found.", 404);
          if (request.status !== "pending") {
            throw createHttpError("This request has already been reviewed.", 409);
          }

          const { decision, reviewNote } = req.validatedBody;
          const now = new Date();
          const update = {
            $set: {
              "orderRequests.$.status": decision,
              "orderRequests.$.reviewNote": reviewNote,
              "orderRequests.$.reviewedAt": now,
            },
          };
          if (decision === "approved" && request.type === "cancellation") {
            update.$set.orderStatus = "cancelled";
            update.$push = {
              statusHistory: {
                status: "cancelled",
                note: reviewNote || "Customer cancellation request approved.",
                at: now,
              },
            };
          }
          const updatedOrder = await Order.findOneAndUpdate(
            {
              orderId: req.params.orderId,
              orderRequests: {
                $elemMatch: { _id: request._id, status: "pending" },
              },
            },
            update,
            { new: true, runValidators: true }
          );
          if (!updatedOrder) {
            throw createHttpError("This request has already been reviewed.", 409);
          }
          const updatedRequest = updatedOrder.orderRequests.id(request._id);

          await sendBestEffortMail({
            event: "Order request review notification",
            to: updatedOrder.customer.email,
            ...orderRequestEmail({ order: updatedOrder, request: updatedRequest, audience: "customer" }),
          });

          return res.status(200).json({
            order: updatedOrder,
            request: updatedRequest,
            message: `Order ${updatedRequest.type} request ${decision}.`,
          });
        } catch (error) {
          return next(error);
        }
      }

      /* -------------------------------------------------------------------------- */
      /* ADMIN CONFIRMATION OF MANUAL REFUND                                        */
      /* POST /api/orders/:orderId/requests/:requestId/refund                       */
      /* -------------------------------------------------------------------------- */

      export async function confirmOrderRefund(req, res, next) {
        try {
          const { refundReference } = req.validatedBody;
          const now = new Date();
          const order = await Order.findOneAndUpdate(
            {
              orderId: req.params.orderId,
              paymentStatus: "paid",
              $and: [
                { orderRequests: { $elemMatch: { _id: req.params.requestId, status: "approved" } } },
                { $or: [{ refundReference: "" }, { refundReference: { $exists: false } }] },
              ],
            },
            {
              $set: {
                paymentStatus: "refunded",
                refundReference,
                "orderRequests.$.status": "refunded",
                "orderRequests.$.refundedAt": now,
              },
            },
            { new: true, runValidators: true }
          );
          if (!order) {
            const existing = await Order.findOne({ orderId: req.params.orderId });
            if (!existing) throw createHttpError("Order not found.", 404);
            if (existing.paymentStatus !== "paid") {
              throw createHttpError("Only a paid order can be marked refunded.");
            }
            if (existing.refundReference) {
              throw createHttpError("A refund has already been recorded for this order.", 409);
            }
            const request = existing.orderRequests.id(req.params.requestId);
            if (!request) throw createHttpError("Order request not found.", 404);
            if (request.status !== "approved") {
              throw createHttpError("Approve the customer request before recording a refund.");
            }
            throw createHttpError("The refund could not be recorded.");
          }

          const request = order.orderRequests.id(req.params.requestId);

          await sendBestEffortMail({
            event: "Order refund notification",
            to: order.customer.email,
            ...orderRequestEmail({ order, request, audience: "customer" }),
          });

          return res.status(200).json({
            order,
            message: "Manual refund recorded. The customer has been notified.",
          });
        } catch (error) {
          return next(error);
        }
      }
