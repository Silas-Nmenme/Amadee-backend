import { Promo } from "../models/Promo.js";

export const PROMO_ALREADY_USED_MESSAGE = "this code has been used already by you.";

function promoError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function hasUserRedeemed(promo, userId) {
  return Boolean(userId && promo.redeemedBy?.some(id => String(id) === String(userId)));
}

export function calculatePromoDiscount(promo, items, subtotal) {
  const eligibleCodes = new Set(promo.applicableProductCodes || []);
  const eligibleSubtotal = items.reduce((sum, item) => {
    if (eligibleCodes.size && !eligibleCodes.has(item.productId)) return sum;
    return sum + item.lineTotal;
  }, 0);

  if (subtotal < promo.minSubtotal) {
    throw Object.assign(
      new Error(`This code requires a minimum order of ₦${promo.minSubtotal}.`),
      { status: 400 }
    );
  }

  if (eligibleSubtotal <= 0) {
    throw Object.assign(new Error("This code does not apply to items in your order."), {
      status: 400,
    });
  }

  const discount =
    promo.type === "percent"
      ? Math.round((eligibleSubtotal * promo.value) / 100)
      : Math.min(eligibleSubtotal, promo.value);

  return { discount, eligibleSubtotal };
}

export async function findUsablePromo(code, userId) {
  const promo = await Promo.findOne({ code: code.toUpperCase() }).lean();

  if (!promo) {
    throw promoError("This promo code is invalid, expired, inactive, or fully redeemed.");
  }
  if (hasUserRedeemed(promo, userId)) {
    throw promoError(PROMO_ALREADY_USED_MESSAGE);
  }
  if (!promo.active || (promo.expiresAt && promo.expiresAt <= new Date())) {
    throw promoError("This promo code is invalid, expired, inactive, or fully redeemed.");
  }
  if (promo.maxUses != null && promo.uses >= promo.maxUses) {
    throw promoError("This promo code is invalid, expired, inactive, or fully redeemed.");
  }

  return promo;
}

export async function reservePromoUse(promo, userId) {
  if (!userId) throw promoError("Authentication is required to redeem a promo code.", 401);
  const now = new Date();
  const filter = {
    _id: promo._id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    active: true,
    redeemedBy: { $ne: userId },
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
    ],
  };
  if (promo.minSubtotal != null) filter.minSubtotal = promo.minSubtotal;
  if (promo.applicableProductCodes) {
    filter.applicableProductCodes = promo.applicableProductCodes;
  }

  const reserved = await Promo.findOneAndUpdate(
    filter,
    { $inc: { uses: 1 }, $addToSet: { redeemedBy: userId } },
    { new: true }
  );
  if (!reserved) {
    const currentPromo = await Promo.findById(promo._id).select("redeemedBy").lean();
    if (hasUserRedeemed(currentPromo || {}, userId)) {
      throw promoError(PROMO_ALREADY_USED_MESSAGE);
    }
    throw promoError("This promo code is no longer available.");
  }
}

export async function releasePromoUse(promoId, userId) {
  await Promo.updateOne(
    { _id: promoId, uses: { $gt: 0 } },
    { $inc: { uses: -1 }, $pull: { redeemedBy: userId } }
  );
}
