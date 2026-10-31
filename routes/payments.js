
import { Router } from "express";

import {
  initializePayment,
  verifyPayment,
  paystackWebhook,
} from "../controllers/paymentsController.js";

const router = Router();

router.post("/initialize", initializePayment);

router.get("/verify/:reference", verifyPayment);

router.post("/paystack/webhook", paystackWebhook);

export default router;
