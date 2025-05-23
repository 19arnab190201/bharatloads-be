const cloudinary = require("cloudinary").v2;
const fs = require("fs");
require("dotenv").config();

// Validate required environment variables
const requiredEnvVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

const uploadToCloud = async (filePath) => {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  try {
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "bharatloads/uploads",
      resource_type: "auto",
    });

    // Delete the temporary file
    fs.unlinkSync(filePath);

    // Return the secure URL
    console.log("result", result?.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
};

module.exports = { uploadToCloud };
