import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/**
 * Upload single buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} folder - Destination folder
 */
export const uploadToCloudinary = (buffer, folder = 'FlashBasket') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (result) {
          resolve({
            url: result.secure_url,
            public_id: result.public_id
          });
        } else {
          console.error("Cloudinary Upload Error:", error);
          reject(error);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Delete asset from Cloudinary
 * @param {string} public_id - Asset public ID
 */
export const deleteFromCloudinary = async (public_id) => {
  try {
    if (!public_id) return;
    return await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
  }
};

/**
 * Upload multiple buffers to Cloudinary
 * @param {Array<Buffer>} buffers - Array of file buffers
 */
export const uploadMultipleToCloudinary = async (buffers) => {
  const uploadPromises = buffers.map(buffer => uploadToCloudinary(buffer));
  const results = await Promise.all(uploadPromises);
  return results.map(r => r.url); // Legacy support for products returning only URLs
};
