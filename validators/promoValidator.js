import { z } from "zod";

const code = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform(value => value.toUpperCase());
const productCodes = z.array(z.string().trim().min(2).max(40).transform(value => value.toUpperCase())).max(100).default([]);

export const promoQuoteSchema = z.object({
  code,
  items: z.array(z.object({
    productId: z.string().trim().min(2).max(40).transform(value => value.toUpperCase()),
    quantity: z.number().int().min(1).max(20),
  })).min(1).max(30),
});

export const promoAdminSchema = z.object({
  code,
  name: z.string().trim().min(2).max(120),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().positive().max(100000000),
  minSubtotal: z.number().int().min(0).max(1000000000).default(0),
  applicableProductCodes: productCodes,
  maxUses: z.number().int().positive().nullable().default(null),
  expiresAt: z.string().datetime().nullable().default(null),
  active: z.boolean().default(true),
  publishAnnouncement: z.boolean().default(false),
  announcementText: z.string().trim().max(500).default(""),
}).superRefine((promo, context) => {
  if (promo.type === "percent" && promo.value > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage discounts cannot exceed 100%." });
  }
  if (promo.publishAnnouncement && !promo.announcementText) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["announcementText"], message: "Add announcement text before publishing." });
  }
});
