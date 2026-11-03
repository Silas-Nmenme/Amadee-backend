import multer from "multer";

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 8 * 1024 * 1024,
    fields: 0,
    parts: 10,
  },
  fileFilter(_req, file, callback) {
    if (!imageTypes.has(file.mimetype)) {
      return callback(Object.assign(
        new Error("Upload JPG, PNG, WebP, or AVIF images only."),
        { status: 400 }
      ));
    }

    return callback(null, true);
  },
}).array("images", 10);

export function productImageUpload(req, res, next) {
  upload(req, res, error => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({
        message: error.code === "LIMIT_FILE_SIZE"
          ? "Each product image must be 8 MB or smaller."
          : error.code === "LIMIT_FILE_COUNT"
            ? "Upload no more than 10 images at a time."
            : "The product image upload is invalid or too large.",
      });
    }

    return res.status(error.status || 400).json({
      message: error.message || "Product image upload failed.",
    });
  });
}
