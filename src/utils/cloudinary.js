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
          resolve(result.secure_url);
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
 * Upload multiple buffers to Cloudinary
 * @param {Array<Buffer>} buffers - Array of file buffers
 */
export const uploadMultipleToCloudinary = async (buffers) => {
  const uploadPromises = buffers.map(buffer => uploadToCloudinary(buffer));
  return Promise.all(uploadPromises);
};
