import { Promo } from "../models/Promo.js";

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

export async function findUsablePromo(code) {
  const now = new Date();
  const promo = await Promo.findOne({
    code: code.toUpperCase(),
    active: true,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
    ],
  }).lean();

  if (!promo) {
    throw Object.assign(new Error("This promo code is invalid, expired, inactive, or fully redeemed."), {
      status: 400,
    });
  }

  return promo;
}

export async function reservePromoUse(promo) {
  const now = new Date();
  const filter = {
    _id: promo._id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    active: true,
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
    { $inc: { uses: 1 } },
    { new: true }
  );
  if (!reserved) {
    throw Object.assign(new Error("This promo code is no longer available."), {
      status: 400,
    });
  }
}

export async function releasePromoUse(promoId) {
  await Promo.updateOne({ _id: promoId, uses: { $gt: 0 } }, { $inc: { uses: -1 } });
}
