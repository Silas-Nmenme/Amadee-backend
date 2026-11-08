import Order from "../models/Order.js";
import Review from "../models/Review.js";
import Subscriber from "../models/Subscriber.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

/**
 * GET /api/admin/summary
 * Returns statistics for the admin dashboard.
 */
export const getAdminSummary = async (_req, res, next) => {
  try {
    const [
      orders,
      customers,
      pendingReviews,
      subscribers,
      paidOrderStats,
    ] = await Promise.all([
      Order.countDocuments(),

      User.countDocuments({
        role: "customer",
      }),

      Review.countDocuments({
        approved: false,
      }),

      Subscriber.countDocuments({
        active: true,
      }),

      Order.aggregate([
        {
          $match: { paymentStatus: "paid" },
        },
        {
          $group: {
            _id: null,
            paidCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
            },
            total: {
              $sum: "$total",
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      summary: {
        orders,
        paidOrders: paidOrderStats[0]?.paidCount || 0,
        customers,
        pendingReviews,
        subscribers,
        revenueNgn: paidOrderStats[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/subscribers
 * Returns active newsletter subscribers.
 */
export const getAdminSubscribers = async (_req, res, next) => {
  try {
    const subscribers = await Subscriber.find({
      active: true,
    })
      .select("email subscribedAt")
      .sort({ subscribedAt: -1 })
      .limit(1000)
      .lean();

    return res.status(200).json({
      subscribers,
      count: subscribers.length,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminMessages = async (req, res, next) => {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 25;

    const [messages, total, unhandled] = await Promise.all([
      Message.find()
        .sort({ handled: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments(),
      Message.countDocuments({ handled: false }),
    ]);

    return res.status(200).json({
      messages,
      unhandled,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAdminMessageHandled = async (req, res, next) => {
  try {
    const { handled } = req.validatedBody;
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      {
        $set: {
          handled,
          handledAt: handled ? new Date() : null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!message) return res.status(404).json({ message: "Contact message not found." });
    return res.status(200).json({ message, status: "Contact message updated." });
  } catch (error) {
    return next(error);
  }
};
