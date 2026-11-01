import mongoose from "mongoose";

export function validateObjectId(parameter = "id") {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[parameter])) {
      return res.status(400).json({
        message: `Invalid ${parameter}.`,
      });
    }

    return next();
  };
}
