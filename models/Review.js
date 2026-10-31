
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },

    productId: {
      type: String,
      index: true,
      trim: true,
    },

    approved: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Review =
  mongoose.models.Review ||
  mongoose.model("Review", reviewSchema);

export { Review };
export default Review;
