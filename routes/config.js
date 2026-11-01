import { Router } from "express";

const router = Router();

// Fees must match routes/orders.js exactly — the frontend only displays
// these, the server is the source of truth for money.
const deliveryFees = { pickup: 0, lagos: 2000, outside: 5000 };

router.get("/", (_req, res) => {
  res.json({
    currency: "NGN",
    deliveryFees,
    whatsapp: process.env.SHOP_WHATSAPP_NUMBER || "2349034063970",
    payments: {
      paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
      bankTransfer: true,
      payOnDelivery: true,
    },
  });
});

export default router;
