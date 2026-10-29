
import { randomUUID } from "node:crypto";

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { sendMail } from "../services/mailer.js";
import {
  orderReceivedEmail,
  orderStatusEmail,
} from "../templates/emailTemplates.js";

const deliveryFees = {
  pickup: 0,
  lagos: 2000,
  outside: 5000,
};

// Promo codes intentionally remain disabled until real codes are configured.
const promoCodes = {};

function createHttpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
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
  if (!process.env.SHOP_OWNER_EMAIL) return;

  const itemSummary = order.items
    .map(
      (item) =>
        `${item.name} (${item.productId}) × ${item.quantity} — ${formatNaira(item.lineTotal)}`
    )
    .join("\n");

  await sendMail({
    to: process.env.SHOP_OWNER_EMAIL,
    subject: `New Amadee-Stiches order ${order.orderId}`,
    text: [
      `Order: ${order.orderId}`,
      `Customer: ${order.customer.name} (${order.customer.email})`,
      `Phone: ${order.customer.phone}`,
      `Address: ${order.customer.address}`,
      `Delivery option: ${order.deliveryOption}`,
      "",
      itemSummary,
      "",
      `Subtotal: ${formatNaira(order.subtotal)}`,
      `Discount: ${formatNaira(order.discount)}`,
      `Delivery: ${formatNaira(order.deliveryFee)}`,
      `Total: ${formatNaira(order.total)}`,
      `Payment method: ${order.paymentMethod}`,
      `Payment status: ${order.paymentStatus}`,
    ].join("\n"),
  });
}

async function notifyCustomer(order) {
  if (!order.customer?.email) return;

  try {
    await sendMail({
      to: order.customer.email,
      ...orderReceivedEmail(order),
    });
  } catch (error) {
    console.error(
      "Customer order email failed:",
      error instanceof Error ? error.message : error
    );
  }
}

async function notifyOrderParties(order) {
  await notifyCustomer(order);

  try {
    await notifyOwner(order);
  } catch (error) {
    console.error(
      "Order notification email failed:",
      error instanceof Error ? error.message : error
    );
  }
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

    if (promoCode) {
      const promo = promoCodes[promoCode];

      if (!promo) {
        throw createHttpError(
          "This promo code is not currently valid."
        );
      }

      discount =
        promo.type === "percent"
          ? Math.round((subtotal * promo.value) / 100)
          : Math.min(subtotal, promo.value);
    }

    const deliveryFee = deliveryFees[body.deliveryOption];
    const total = Math.max(0, subtotal - discount + deliveryFee);

    const orderId = `AS-${Date.now()
      .toString(36)
      .toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const measurements = normalizeMeasurements(body.measurements);

    // Save the order before initializing Paystack so the transaction
    // reference can be associated with a persistent order.
    const order = await Order.create({
      orderId,
      customer: body.customer,
      items,
      deliveryOption: body.deliveryOption,
      measurements,
      promoCode: "",
      subtotal,
      discount,
      deliveryFee,
      total,
      paymentMethod: body.paymentMethod,
      paymentStatus: "pending",
      orderStatus: "received",
    });

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

/* -------------------------------------------------------------------------- */
/* CUSTOMER ORDER HISTORY                                                     */
/* GET /api/orders/mine                                                       */
/* -------------------------------------------------------------------------- */

export async function getMyOrders(req, res, next) {
  try {
    const email = req.user?.email?.toLowerCase();

    if (!email) {
      throw createHttpError("Unable to identify the authenticated user.", 401);
    }

    const orders = await Order.find({
      "customer.email": email,
    })
      .select(
        "orderId items subtotal discount deliveryFee total paymentMethod paymentStatus paymentReference orderStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ orders });
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

    return res.status(200).json({
      orders,
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
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      return res.status(200).json({
        order: existingOrder,
        message: "Order already has this status.",
      });
    }

    // Email errors must not undo a successful status update.
    try {
      if (order.customer?.email) {
        await sendMail({
          to: order.customer.email,
          ...orderStatusEmail({
            order,
            status: order.orderStatus,
          }),
        });
      }
    } catch (error) {
      console.error(
        "Order status email failed:",
        error instanceof Error ? error.message : error
      );
    }

    return res.status(200).json({
      order,
      message: "Order status updated successfully.",
    });
  } catch (error) {
    return next(error);
  }
}
