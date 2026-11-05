import { Router } from "express";
import { getActivePromotions, validatePromo } from "../controllers/promoController.js";
import { validate } from "../middleware/validate.js";
import { promoQuoteSchema } from "../validators/promoValidator.js";

const router = Router();

router.get("/active", getActivePromotions);
router.post("/validate", validate(promoQuoteSchema), validatePromo);

export default router;
