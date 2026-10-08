import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const createDirectSchema = z.object({
  type: z.literal('direct'),
  memberId: objectIdSchema,
});

const createGroupSchema = z.object({
  type: z.literal('group'),
  name: z.string().min(1).max(100),
  avatar: z.string().optional(),
  memberIds: z.array(objectIdSchema).min(1),
});

export const validateCreateConversation = (req, res, next) => {
  let result;
  if (req.body.type === 'direct') {
    result = createDirectSchema.safeParse(req.body);
  } else if (req.body.type === 'group') {
    result = createGroupSchema.safeParse(req.body);
  } else {
    return next(new AppError('Invalid conversation type', 400));
  }

  if (!result.success) {
    const errorMsg = result.error.errors.map(err => err.message).join(', ');
    return next(new AppError(`Validation failed: ${errorMsg}`, 400));
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

const addMemberSchema = z.object({
  memberId: objectIdSchema,
});

export const validateAddMember = (req, res, next) => {
  const result = addMemberSchema.safeParse(req.body);
  if (!result.success) {
    return next(new AppError('Invalid member ID', 400));
  }
  next();
};

export const validateRemoveMember = (req, res, next) => {
  const result = objectIdSchema.safeParse(req.params.userId);
  if (!result.success) {
    return next(new AppError('Invalid user ID', 400));
  }
  next();
};
