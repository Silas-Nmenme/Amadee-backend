
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import Subscriber from "../models/Subscriber.js";
import User from "../models/User.js";

/**
 * GET /api/admin/summary
 * Returns statistics for the admin dashboard.
 */
export const getAdminSummary = async (_req, res, next) => {
  try {
    const [
      orders,
      paidOrders,
      customers,
      pendingReviews,
      subscribers,
      revenueRows,
    ] = await Promise.all([
      Order.countDocuments(),

      Order.countDocuments({
        paymentStatus: "paid",
      }),

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
          $match: {
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
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
        paidOrders,
        customers,
        pendingReviews,
        subscribers,
        revenueNgn: revenueRows[0]?.total || 0,
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
