
import { z } from "zod";

export const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254).transform((value) =>
      value.toLowerCase()
    ),
    phone: z.string().trim().min(7).max(25),
    address: z.string().trim().min(3).max(300),
  }),

  items: z
    .array(
      z.object({
        productId: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .transform((value) => value.toUpperCase()),
        quantity: z.number().int().min(1).max(20),
        size: z.string().trim().max(30).optional().default(""),
        colour: z.string().trim().max(50).optional().default(""),
      })
    )
    .min(1)
    .max(30),

  deliveryOption: z.enum(["pickup", "lagos", "outside"]),

  promoCode: z.string().trim().max(40).optional().default(""),

  measurements: z
    .object({
      bustChest: z.union([z.string(), z.number()]).optional(),
      waist: z.union([z.string(), z.number()]).optional(),
      hip: z.union([z.string(), z.number()]).optional(),
      length: z.union([z.string(), z.number()]).optional(),
      notes: z.string().trim().max(1000).optional().default(""),
    })
    .optional()
    .default({}),

  paymentMethod: z.enum([
    "paystack",
    "bank_transfer",
    "pay_on_delivery",
  ]),
});

export const orderStatusSchema = z.object({
  orderStatus: z.enum([
    "received",
    "confirmed",
    "in_production",
    "ready",
    "dispatched",
    "completed",
    "cancelled",
  ]),
});
