import mongoose from "mongoose";
import Product from "../models/Product.js";
import { Promo } from "../models/Promo.js";
import { calculatePromoDiscount, findUsablePromo } from "../services/promoService.js";

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function getPricedItems(requestedItems) {
  const productCodes = [...new Set(requestedItems.map(item => item.productId))];
  const products = await Product.find({
    productCode: { $in: productCodes },
    active: true,
  }).select("productCode price").lean();
  const productsByCode = new Map(products.map(product => [product.productCode, product]));

  return requestedItems.map(item => {
    const product = productsByCode.get(item.productId);
    if (!product) throw httpError(`Product "${item.productId}" is unavailable or does not exist.`);
    return { productId: product.productCode, lineTotal: product.price * item.quantity };
  });
}

export async function getActivePromotions(_req, res, next) {
  try {
    const now = new Date();
    const promotions = await Promo.find({
      active: true,
      publishAnnouncement: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
      ],
    })
      .select("code name type value minSubtotal applicableProductCodes expiresAt announcementText updatedAt")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    return res.status(200).json({ promotions });
  } catch (error) {
    return next(error);
  }
}

export async function validatePromo(req, res, next) {
  try {
    const promo = await findUsablePromo(req.validatedBody.code);
    const items = await getPricedItems(req.validatedBody.items);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const quote = calculatePromoDiscount(promo, items, subtotal);
    return res.status(200).json({
      code: promo.code,
      name: promo.name || promo.code,
      subtotal,
      ...quote,
      totalAfterDiscount: subtotal - quote.discount,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAdminPromos(_req, res, next) {
  try {
    const promotions = await Promo.find().sort({ createdAt: -1 }).limit(500).lean();
    return res.status(200).json({ promotions });
  } catch (error) {
    return next(error);
  }
}

export async function createPromo(req, res, next) {
  try {
    const promo = await Promo.create(req.validatedBody);
    return res.status(201).json({ promo, message: "Campaign created." });
  } catch (error) {
    if (error?.code === 11000) return next(httpError("That promo code is already in use.", 409));
    return next(error);
  }
}

export async function updatePromo(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError("Invalid campaign ID.");
    const promo = await Promo.findByIdAndUpdate(
      req.params.id,
      req.validatedBody,
      { new: true, runValidators: true }
    );
    if (!promo) throw httpError("Campaign not found.", 404);
    return res.status(200).json({ promo, message: "Campaign updated." });
  } catch (error) {
    if (error?.code === 11000) return next(httpError("That promo code is already in use.", 409));
    return next(error);
  }
}
