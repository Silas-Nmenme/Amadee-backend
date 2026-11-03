import { Router } from "express";

import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
} from "../controllers/productcontroller.js";
import { uploadProductImages } from "../controllers/productImageController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { productImageUpload } from "../middleware/productImageUpload.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/adminProductValidator.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", getAdminProducts);
router.post("/images", productImageUpload, uploadProductImages);
router.post("/", validate(createProductSchema), createProduct);
router.patch(
  "/:id",
  validateObjectId(),
  validate(updateProductSchema),
  updateProduct
);
router.delete("/:id", validateObjectId(), deactivateProduct);

export default router;
