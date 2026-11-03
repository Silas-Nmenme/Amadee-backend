import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import { v2 as cloudinary } from "cloudinary";

import {
  createProduct,
  deactivateProduct,
  updateProduct,
} from "../controllers/productcontroller.js";
import Product from "../models/Product.js";
import adminProductsRouter from "../routes/adminProducts.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/adminProductValidator.js";
import {
  deleteProductImages,
  uploadProductImage,
} from "../services/cloudinary.js";

const validProduct = {
  productCode: "as-001",
  name: "Blue dress",
  description: "A blue dress.",
  category: "Dresses",
  price: 25000,
  images: ["https://res.cloudinary.com/demo/image/upload/dress.jpg"],
  imagePublicIds: ["amadee-stiches/products/dress"],
  stock: 5,
};

function routeFor(path, method) {
  return adminProductsRouter.stack.find(
    layer => layer.route?.path === path && layer.route.methods[method]
  )?.route;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("admin product image upload route is authenticated and parses image files", () => {
  const imageRoute = routeFor("/images", "post");
  assert.ok(imageRoute);
  assert.ok(imageRoute.stack.some(layer => layer.name === "productImageUpload"));
  assert.ok(imageRoute.stack.some(layer => layer.name === "uploadProductImages"));
  assert.ok(adminProductsRouter.stack.some(layer => layer.name === "requireAuth"));
  assert.ok(adminProductsRouter.stack.some(layer => layer.name === "requireAdmin"));
});

test("product schemas accept HTTP(S) image URLs and aligned Cloudinary IDs", () => {
  const parsed = createProductSchema.parse(validProduct);
  assert.equal(parsed.productCode, "AS-001");
  assert.deepEqual(parsed.imagePublicIds, validProduct.imagePublicIds);

  assert.equal(
    createProductSchema.safeParse({
      ...validProduct,
      images: ["javascript:alert(1)"],
    }).success,
    false
  );
  assert.equal(
    createProductSchema.safeParse({
      ...validProduct,
      imagePublicIds: [],
    }).success,
    false
  );
  assert.equal(
    updateProductSchema.safeParse({
      images: validProduct.images,
      imagePublicIds: [],
    }).success,
    false
  );
});

test("Cloudinary image uploads stream buffers and return URL plus public ID", async t => {
  const originalEnvironment = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.CLOUDINARY_CLOUD_NAME = "local-test-cloud";
  process.env.CLOUDINARY_API_KEY = "local-test-key";
  process.env.CLOUDINARY_API_SECRET = "local-test-secret";

  let uploadedBuffer = Buffer.alloc(0);
  let uploadOptions;
  t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => {
    uploadOptions = options;
    return new Writable({
      write(chunk, _encoding, done) {
        uploadedBuffer = Buffer.concat([uploadedBuffer, chunk]);
        done();
      },
      final(done) {
        callback(null, {
          secure_url: "https://res.cloudinary.com/test/products/dress.jpg",
          public_id: "amadee-stiches/products/dress",
        });
        done();
      },
    });
  });

  const buffer = Buffer.from("local image fixture");
  const result = await uploadProductImage(buffer, {
    mimeType: "image/jpeg",
    originalName: "dress.jpg",
  });

  assert.deepEqual(uploadedBuffer, buffer);
  assert.equal(uploadOptions.folder, "amadee-stiches/products");
  assert.equal(uploadOptions.resource_type, "image");
  assert.deepEqual(result, {
    url: "https://res.cloudinary.com/test/products/dress.jpg",
    publicId: "amadee-stiches/products/dress",
  });
});

test("Cloudinary deletion deduplicates IDs and accepts already-missing images", async t => {
  const originalEnvironment = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.CLOUDINARY_CLOUD_NAME = "local-test-cloud";
  process.env.CLOUDINARY_API_KEY = "local-test-key";
  process.env.CLOUDINARY_API_SECRET = "local-test-secret";

  let deletedIds;
  t.mock.method(cloudinary.api, "delete_resources", async (ids, options) => {
    deletedIds = ids;
    assert.equal(options.resource_type, "image");
    return { deleted: { [ids[0]]: "deleted", [ids[1]]: "not_found" } };
  });

  await deleteProductImages(["products/one", "products/one", "products/two"]);
  assert.deepEqual(deletedIds, ["products/one", "products/two"]);
});

test("product creation persists Cloudinary IDs alongside the image URLs", async t => {
  let created;
  t.mock.method(Product, "create", async data => {
    created = data;
    return { ...data, _id: "product-id" };
  });
  const res = responseRecorder();

  await createProduct({ validatedBody: validProduct }, res, error => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(created.images, validProduct.images);
  assert.deepEqual(created.imagePublicIds, validProduct.imagePublicIds);
});

test("product editing replaces Cloudinary image IDs and deletes removed assets", async t => {
  const originalEnvironment = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.CLOUDINARY_CLOUD_NAME = "local-test-cloud";
  process.env.CLOUDINARY_API_KEY = "local-test-key";
  process.env.CLOUDINARY_API_SECRET = "local-test-secret";

  const updatedProduct = {
    _id: "product-id",
    productCode: "AS-001",
    images: ["https://res.cloudinary.com/test/products/new.jpg"],
    imagePublicIds: ["products/new"],
  };
  let update;
  let deletedIds;
  t.mock.method(Product, "findById", async () => ({
    imagePublicIds: ["products/old"],
  }));
  t.mock.method(Product, "findByIdAndUpdate", async (_id, updateDocument) => {
    update = updateDocument;
    return updatedProduct;
  });
  t.mock.method(cloudinary.api, "delete_resources", async ids => {
    deletedIds = ids;
    return { deleted: { [ids[0]]: "deleted" } };
  });
  const res = responseRecorder();

  await updateProduct({
    params: { id: "product-id" },
    validatedBody: {
      images: updatedProduct.images,
      imagePublicIds: updatedProduct.imagePublicIds,
    },
  }, res, error => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(update.$set.imagePublicIds, ["products/new"]);
  assert.deepEqual(deletedIds, ["products/old"]);
});

test("product deletion remains a soft-delete", async t => {
  let update;
  const product = { _id: "product-id", active: false };
  t.mock.method(Product, "findByIdAndUpdate", async (_id, updateDocument) => {
    update = updateDocument;
    return product;
  });
  const res = responseRecorder();

  await deactivateProduct({ params: { id: "product-id" } }, res, error => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(update, { $set: { active: false } });
  assert.equal(res.body.product.active, false);
});

test("Cloudinary operations fail explicitly when credentials are missing", async t => {
  const originalEnvironment = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  await assert.rejects(
    async () => uploadProductImage(Buffer.from("fixture"), { mimeType: "image/png" }),
    error => error.status === 503 && /Cloudinary is not configured/.test(error.message)
  );
});
