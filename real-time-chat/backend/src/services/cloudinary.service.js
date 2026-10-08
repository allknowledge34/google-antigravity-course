import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: env.CLOUDINARY_API_KEY || '1234567890',
  api_secret: env.CLOUDINARY_API_SECRET || 'secret'
});

export const uploadStream = (fileBuffer, folder = 'chat_attachments') => {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(upload);
  });
};
