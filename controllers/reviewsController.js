import Review from "../models/Review.js";

export async function getApprovedReviews(_req, res, next) {
  try {
    const reviews = await Review.find({ approved: true })
      .select("name rating message productId createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      reviews: reviews.map(({ _id, name, rating, message, productId, createdAt }) => ({
        id: String(_id),
        name,
        rating,
        message,
        productId,
        createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function submitReview(req, res, next) {
  try {
    const { name, rating, message, website } = req.validatedBody;

    if (website) {
      return res.status(200).json({ message: "Review submitted for moderation." });
    }

    const review = await Review.create({
      name,
      rating,
      message,
      approved: false,
    });

    return res.status(201).json({
      message: "Review submitted for moderation.",
      review: {
        id: String(review._id),
        name: review.name,
        rating: review.rating,
        message: review.message,
        createdAt: review.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPendingReviews(_req, res, next) {
  try {
    const reviews = await Review.find({ approved: false })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      reviews: reviews.map(({ _id, name, rating, message, createdAt }) => ({
        id: String(_id),
        name,
        rating,
        message,
        createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

export async function moderateReview(req, res, next) {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          approved: req.validatedBody.approved,
          moderatedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    ).select("name rating message approved createdAt");

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    return res.status(200).json({ review });
  } catch (error) {
    return next(error);
  }
}

export async function deleteReview(req, res, next) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    return res.status(200).json({ message: "Review deleted." });
  } catch (error) {
    return next(error);
  }
}
