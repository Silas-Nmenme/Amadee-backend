
import { Router } from "express";
import {
  getProducts,
  getProductByCode,
} from "../controllers/productcontroller.js";

const router = Router();

// GET /api/products
router.get("/", getProducts);

// GET /api/products/AS-001
router.get("/:productCode", getProductByCode);

export default router;
