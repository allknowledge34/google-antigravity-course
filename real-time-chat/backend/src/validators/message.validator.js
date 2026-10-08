import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const createMessageSchema = z.object({
  clientMessageId: z.string().min(1).max(100),
  content: z.string().trim().max(5000).optional(),
  type: z.enum(['text', 'image', 'video', 'file']).optional(),
  replyTo: objectIdSchema.optional(),
  attachment: z.object({
    url: z.string(),
    publicId: z.string(),
    format: z.string(),
    size: z.number()
  }).optional(),
});

export const validateCreateMessage = (req, res, next) => {
  const result = createMessageSchema.safeParse(req.body);
  if (!result.success) {
    const errorMsg = result.error.errors.map(err => err.message).join(', ');
    return next(new AppError(`Validation failed: ${errorMsg}`, 400));
  }
  next();
};

export const validateMessageId = (req, res, next) => {
  const result = objectIdSchema.safeParse(req.params.messageId);
  if (!result.success) {
    return next(new AppError('Invalid message ID', 400));
  }
  next();
};

export const validateConversationId = (req, res, next) => {
  const result = objectIdSchema.safeParse(req.params.conversationId);
  if (!result.success) {
    return next(new AppError('Invalid conversation ID', 400));
  }
  next();
};

const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const validateEditMessage = (req, res, next) => {
  const result = editMessageSchema.safeParse(req.body);
  if (!result.success) {
    return next(new AppError('Invalid content for edit', 400));
  }
  next();
};

export const validateGetMessagesQuery = (req, res, next) => {
  const querySchema = z.object({
    limit: z.string().regex(/^\d+$/).optional().transform(Number),
    before: objectIdSchema.optional(),
  });

  const result = querySchema.safeParse(req.query);
  if (!result.success) {
    return next(new AppError('Invalid query parameters', 400));
  }
  
  req.validatedQuery = result.data;
  next();
};

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(10)
});

export const validateReaction = (req, res, next) => {
  const result = reactionSchema.safeParse(req.body);
  if (!result.success) {
    return next(new AppError('Invalid reaction emoji', 400));
  }
  next();
};
