
import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    unsubscribeToken: {
      type: String,
      default: undefined,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Normalize email addresses before saving.
subscriberSchema.pre("validate", function () {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }
});

const Subscriber =
  mongoose.models.Subscriber ||
  mongoose.model("Subscriber", subscriberSchema);

export { Subscriber };
export default Subscriber;
