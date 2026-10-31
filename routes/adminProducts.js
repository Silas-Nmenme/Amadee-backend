
import { Router } from "express";
import { z } from "zod";

import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
} from "../controllers/productController.js";

import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const productFields = {
  productCode: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(1).max(3000),
  category: z.string().trim().min(2).max(100),
  price: z.coerce.number().finite().min(0),
  images: z.array(z.string().trim().url()).max(20).default([]),
  sizes: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  colours: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
};

const createProductSchema = z.object(productFields).strict();

const updateProductSchema = z
  .object({
    productCode: productFields.productCode.optional(),
    name: productFields.name.optional(),
    description: productFields.description.optional(),
    category: productFields.category.optional(),
    price: productFields.price.optional(),
    images: productFields.images.optional(),
    sizes: productFields.sizes.optional(),
    colours: productFields.colours.optional(),
    stock: productFields.stock.optional(),
    lowStockThreshold: productFields.lowStockThreshold.optional(),
    featured: productFields.featured.optional(),
    active: productFields.active.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

// GET /api/admin/products
router.get("/", getAdminProducts);

// POST /api/admin/products
router.post("/", validate(createProductSchema), createProduct);

// PATCH /api/admin/products/:id
router.patch("/:id", validate(updateProductSchema), updateProduct);

// DELETE /api/admin/products/:id
router.delete("/:id", deactivateProduct);

export default router;
