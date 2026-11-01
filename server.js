import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";

import ordersRouter from "./routes/orders.js";
import contactRouter from "./routes/contact.js";
import newsletterRouter from "./routes/newsletter.js";
import authRouter from "./routes/auth.js";
import reviewsRouter from "./routes/reviews.js";
import paymentsRouter from "./routes/payments.js";
import configRouter from "./routes/config.js";
import adminRouter from "./routes/admin.js";
import productsRouter from "./routes/products.js";
import adminProductsRouter from "./routes/adminProducts.js";

import connectDB from "./config/db.js";

const app = express();

const port = Number(process.env.PORT) || 3000;
const productionFrontendOrigin = "https://amadeestiches.netlify.app";
const configuredFrontendOrigins = [
  process.env.FRONTEND_ORIGINS,
  process.env.FRONTEND_ORIGIN,
]
  .flatMap((value) => (value || "").split(","))
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set([
  productionFrontendOrigin,
  ...configuredFrontendOrigins,
]);

function isLocalDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as server-to-server
      // requests and certain command-line health checks.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin) || isLocalDevelopmentOrigin(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse JSON while preserving the original body for Paystack's webhook.
// This middleware MUST run before the payments router is mounted.
app.use(
  express.json({
    limit: "100kb",
    verify(req, res, buffer) {
      const requestPath = req.originalUrl.split("?")[0];

      if (requestPath === "/api/payments/paystack/webhook") {
        req.rawBody = Buffer.from(buffer);
      }
    },
  })
);

app.use(cookieParser());
// 
// Rate-limit API requests.
app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend API is running successfully",
  });
});

// General API routes.
app.use("/api/config", configRouter);
app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/contact", contactRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/payments", paymentsRouter);

// Public product catalogue.
app.use("/api/products", productsRouter);

// Admin routes: summary, subscribers, and other admin features.
app.use("/api/admin", adminRouter);

// Admin-only product and inventory management.
app.use("/api/admin/products", adminProductsRouter);

// Centralized error handler must remain after all routes.
app.use(errorHandler);

// Connect to MongoDB before accepting requests.
async function startServer() {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log(`Amadee Stiches API running on port ${port}`);
      console.log(
        `Allowed frontend origins: ${[...allowedOrigins].join(", ")}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start Amadee Stiches server:",
      error instanceof Error ? error.message : error
    );

    process.exit(1);
  }
}

startServer();
