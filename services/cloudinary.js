import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw Object.assign(
      new Error("Cloudinary is not configured. Check the backend environment."),
      { status: 503 }
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}

export function uploadProductImage(buffer, { mimeType, originalName }) {
  const client = getCloudinary();

  return new Promise((resolve, reject) => {
    const upload = client.uploader.upload_stream(
      {
        folder: "amadee-stiches/products",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        overwrite: false,
        unique_filename: true,
        use_filename: false,
        context: {
          original_name: String(originalName || "product-image")
            .replace(/[\r\n|]/g, " ")
            .slice(0, 100),
          mime_type: mimeType || "image",
        },
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary returned an incomplete image upload."));
        }

        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(upload);
  });
}

export async function deleteProductImages(publicIds) {
  const uniqueIds = [...new Set(publicIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const client = getCloudinary();
  const result = await client.api.delete_resources(uniqueIds, {
    resource_type: "image",
  });
  const failed = Object.entries(result.deleted || {})
    .filter(([, status]) => status !== "deleted" && status !== "not_found")
    .map(([publicId]) => publicId);

  if (failed.length) {
    throw new Error(`Cloudinary did not delete ${failed.length} product image(s).`);
  }
}
