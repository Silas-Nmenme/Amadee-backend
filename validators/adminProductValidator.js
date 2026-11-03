import { z } from "zod";

const imageUrl = z.string().trim().url().refine(
  value => /^https?:\/\//i.test(value),
  "Product images must use HTTP or HTTPS URLs."
);

const productFields = {
  productCode: z.string().trim().min(2).max(40).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(1).max(3000),
  category: z.string().trim().min(2).max(100),
  price: z.coerce.number().finite().min(0),
  images: z.array(imageUrl).max(20).default([]),
  imagePublicIds: z.array(z.string().trim().max(255)).max(20).optional(),
  sizes: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  colours: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
};

export const createProductSchema = z.object(productFields).strict().refine(
  data => !data.imagePublicIds || data.imagePublicIds.length === data.images.length,
  {
    message: "Each image must have a matching Cloudinary image ID.",
    path: ["imagePublicIds"],
  }
);

export const updateProductSchema = z.object({
  productCode: productFields.productCode.optional(),
  name: productFields.name.optional(),
  description: productFields.description.optional(),
  category: productFields.category.optional(),
  price: productFields.price.optional(),
  images: z.array(imageUrl).max(20).optional(),
  imagePublicIds: productFields.imagePublicIds,
  sizes: productFields.sizes.optional(),
  colours: productFields.colours.optional(),
  stock: productFields.stock.optional(),
  lowStockThreshold: productFields.lowStockThreshold.optional(),
  featured: productFields.featured.optional(),
  active: productFields.active.optional(),
}).strict()
  .refine(
    data => !data.imagePublicIds ||
      (Array.isArray(data.images) && data.imagePublicIds.length === data.images.length),
    {
      message: "Each image must have a matching Cloudinary image ID.",
      path: ["imagePublicIds"],
    }
  )
  .refine(data => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });
