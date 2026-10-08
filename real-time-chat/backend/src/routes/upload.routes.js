import { limiters } from '../middleware/rateLimiter.js';
import { Router } from 'express';
import multer from 'multer';
import { uploadStream } from '../services/cloudinary.service.js';
import { requireAuthentication } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only images, video, audio, and pdf are allowed.', 400), false);
    }
  }
});

router.post('/', requireAuthentication, limiters.messageSend, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file provided', 400);
  }

  const result = await uploadStream(req.file.buffer);

  res.status(200).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes
    }
  });
}));

export default router;
