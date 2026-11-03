import {
  deleteProductImages,
  uploadProductImage,
} from "../services/cloudinary.js";

export async function uploadProductImages(req, res, next) {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({
      message: "Select at least one product image to upload.",
    });
  }

  const uploadedImages = [];
  try {
    for (const file of files) {
      uploadedImages.push(await uploadProductImage(file.buffer, {
        mimeType: file.mimetype,
        originalName: file.originalname,
      }));
    }

    return res.status(201).json({
      images: uploadedImages,
    });
  } catch (error) {
    if (uploadedImages.length) {
      try {
        await deleteProductImages(uploadedImages.map(image => image.publicId));
      } catch (cleanupError) {
        console.error("Could not clean up incomplete product image upload:", {
          message: cleanupError instanceof Error
            ? cleanupError.message
            : cleanupError,
        });
      }
    }

    console.error("Cloudinary product image upload failed:", {
      message: error instanceof Error ? error.message : error,
      http_code: error?.http_code,
    });

    return next(Object.assign(
      new Error("One or more product images could not be uploaded. Please try again."),
      { status: 502 }
    ));
  }
}
