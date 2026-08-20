const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function assertCloudinaryConfigured() {
  const missing = [];

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    missing.push("CLOUDINARY_CLOUD_NAME");
  }

  if (!process.env.CLOUDINARY_API_KEY) {
    missing.push("CLOUDINARY_API_KEY");
  }

  if (!process.env.CLOUDINARY_API_SECRET) {
    missing.push("CLOUDINARY_API_SECRET");
  }

  if (missing.length) {
    throw new Error(
      `Missing Cloudinary environment variables: ${missing.join(", ")}`
    );
  }
}

function uploadBuffer(
  buffer,
  {
    folder,
    resourceType = "image",
    originalFilename = "",
  } = {}
) {
  assertCloudinaryConfigured();

  if (!buffer) {
    return Promise.reject(
      new Error("No file buffer was provided for Cloudinary upload.")
    );
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: resourceType,
      folder,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    };

    if (originalFilename) {
      uploadOptions.filename_override = originalFilename;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(
            new Error("Cloudinary returned no upload result.")
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format || "",
          bytes: result.bytes || 0,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

async function deleteAsset(
  publicId,
  resourceType = "image"
) {
  assertCloudinaryConfigured();

  if (!publicId) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}

module.exports = {
  cloudinary,
  uploadBuffer,
  deleteAsset,
};