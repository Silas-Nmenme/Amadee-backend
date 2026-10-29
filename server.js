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
const allowedOrigin = process.env.FRONTEND_ORIGIN?.trim();

if (process.env.NODE_ENV === "production" && !allowedOrigin) {
  throw new Error(
    "FRONTEND_ORIGIN must be configured in production."
  );
}

if (!allowedOrigin) {
  console.warn(
    "FRONTEND_ORIGIN is not set. Configure it in your .env file."
  );
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

      if (allowedOrigin && origin === allowedOrigin) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
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

// Rate-limit API requests.
app.use("/api", apiLimiter);

// Health-check endpoint.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Amadee Stiches API is running.",
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
      console.log(`Health check: http://localhost:${port}/api/health`);
      console.log(`Products API: http://localhost:${port}/api/products`);
      console.log(`Admin API: http://localhost:${port}/api/admin`);
      console.log(
        `Admin Products API: http://localhost:${port}/api/admin/products`
      );
      console.log(
        `Frontend origin: ${allowedOrigin || "Not configured"}`
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
