import { Router } from "express";

import {
  getPreferences,
  replaceCart,
  replaceWishlist,
} from "../controllers/accountController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/preferences", getPreferences);
router.put("/cart", replaceCart);
router.put("/wishlist", replaceWishlist);

export default router;
