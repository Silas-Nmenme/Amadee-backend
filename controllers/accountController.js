import { z } from "zod";

const snapshotSchema = z.object({
  name: z.string().trim().min(1).max(150),
  price: z.number().finite().min(0),
  images: z.array(z.string().max(1000)).max(20),
  sizes: z.array(z.string().max(60)).max(50),
  colours: z.array(z.string().max(60)).max(50),
  description: z.string().max(3000).optional().default(""),
}).strict();

const cartSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().trim().min(2).max(40),
    size: z.string().trim().max(60),
    colour: z.string().trim().max(60),
    quantity: z.number().int().min(1).max(20),
    snapshot: snapshotSchema.optional(),
  }).strict()).max(100),
}).strict();

const wishlistSchema = z.object({
  wishlistProductIds: z.array(z.string().trim().min(2).max(40)).max(200),
}).strict();

export async function getPreferences(req, res) {
  return res.json({
    cartItems: req.user.cartItems || [],
    wishlistProductIds: req.user.wishlistProductIds || [],
  });
}

export async function replaceCart(req, res, next) {
  try {
    const parsed = cartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide a valid cart.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    req.user.cartItems = parsed.data.cartItems;
    await req.user.save();

    return res.json({
      success: true,
      cartItems: req.user.cartItems,
    });
  } catch (error) {
    return next(error);
  }
}

export async function replaceWishlist(req, res, next) {
  try {
    const parsed = wishlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please provide a valid wishlist.",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    req.user.wishlistProductIds = [...new Set(parsed.data.wishlistProductIds)];
    await req.user.save();

    return res.json({
      success: true,
      wishlistProductIds: req.user.wishlistProductIds,
    });
  } catch (error) {
    return next(error);
  }
}
