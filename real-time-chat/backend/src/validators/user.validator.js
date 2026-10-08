import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
}).strict();

export const validateUpdateProfile = (req, res, next) => {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.errors.map(err => err.message).join(', ');
    return next(new AppError(`Validation failed: ${errorMsg}`, 400));
  }
  next();
};

const searchSchema = z.object({
  q: z.string().max(100).optional()
});

export const validateSearchQuery = (req, res, next) => {
  const result = searchSchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError('Invalid search query', 400));
  }
  next();
};
