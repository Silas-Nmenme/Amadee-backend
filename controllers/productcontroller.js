
import Product from "../models/Product.js";

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/products
 * Public product catalogue with search and pagination.
 */
export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
    );

    const filter = { active: true };

    if (typeof req.query.category === "string" && req.query.category.trim()) {
      filter.category = req.query.category.trim();
    }

    if (typeof req.query.featured === "string") {
      if (req.query.featured === "true") filter.featured = true;
      if (req.query.featured === "false") filter.featured = false;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = new RegExp(
        escapeRegExp(req.query.search.trim()),
        "i"
      );

      filter.$or = [
        { name: search },
        { description: search },
        { productCode: search },
        { category: search },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("-__v")
        .sort({ featured: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:productCode
 * Public product details.
 */
export const getProductByCode = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      productCode: req.params.productCode.toUpperCase(),
      active: true,
    }).lean();

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/products
 * Admin catalogue, including inactive products and low-stock filtering.
 */
export const getAdminProducts = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;

    if (req.query.lowStock === "true") {
      filter.$expr = {
        $lte: ["$stock", "$lowStockThreshold"],
      };
    }

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      products,
      count: products.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/products
 * Create a product.
 */
export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.validatedBody);

    return res.status(201).json({
      message: "Product created successfully.",
      product,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "A product with this product code already exists.",
      });
    }

    next(err);
  }
};

/**
 * PATCH /api/admin/products/:id
 * Update product details or inventory.
 */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.validatedBody },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      message: "Product updated successfully.",
      product,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "A product with this product code already exists.",
      });
    }

    next(err);
  }
};

/**
 * DELETE /api/admin/products/:id
 * Soft-delete by making the product inactive.
 * Existing orders remain intact.
 */
export const deactivateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { active: false } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      message: "Product deactivated successfully.",
      product,
    });
  } catch (err) {
    next(err);
  }
};
