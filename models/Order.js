
import mongoose from "mongoose";

export const ORDER_STATUSES = [
  "received",
  "confirmed",
  "in_production",
  "ready",
  "dispatched",
  "completed",
  "cancelled",
];

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

export const PAYMENT_METHODS = [
  "paystack",
  "bank_transfer",
  "pay_on_delivery",
];

/* -------------------------------------------------------------------------- */
/* ORDER ITEM                                                                 */
/* -------------------------------------------------------------------------- */

const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number.",
      },
    },
    size: {
      type: String,
      trim: true,
      default: "",
    },
    colour: {
      type: String,
      trim: true,
      default: "",
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/* ORDER STATUS HISTORY                                                       */
/* -------------------------------------------------------------------------- */

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/* ORDER MODEL                                                                */
/* -------------------------------------------------------------------------- */

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 254,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 25,
      },
      address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
      },
    },

    items: {
      type: [itemSchema],
      required: true,
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "An order must contain at least one item.",
      },
    },

    measurements: {
      bustChest: {
        type: Number,
        min: 1,
        max: 300,
      },
      waist: {
        type: Number,
        min: 1,
        max: 300,
      },
      hip: {
        type: Number,
        min: 1,
        max: 300,
      },
      length: {
        type: Number,
        min: 1,
        max: 300,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },
    },

    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryOption: {
      type: String,
      enum: ["pickup", "lagos", "outside"],
      required: true,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },

    paymentReference: {
      type: String,
      trim: true,
      sparse: true,
    },

    paymentReferences: {
      type: [String],
      default: [],
    },

    paymentChannel: {
      type: String,
      trim: true,
      default: "",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: "received",
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* -------------------------------------------------------------------------- */
/* INDEXES                                                                    */
/* -------------------------------------------------------------------------- */

orderSchema.index({
  "customer.email": 1,
  createdAt: -1,
});

orderSchema.index({
  orderStatus: 1,
  createdAt: -1,
});

/* -------------------------------------------------------------------------- */
/* PRE-SAVE                                                                   */
/* -------------------------------------------------------------------------- */

orderSchema.pre("save", function () {
  if (
    this.paymentReference &&
    !this.paymentReferences.includes(this.paymentReference)
  ) {
    this.paymentReferences.push(this.paymentReference);
  }

  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.orderStatus,
      note: "Order created",
      at: new Date(),
    });
  }
});

/* -------------------------------------------------------------------------- */
/* EXPORT                                                                     */
/* -------------------------------------------------------------------------- */

const Order =
  mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
