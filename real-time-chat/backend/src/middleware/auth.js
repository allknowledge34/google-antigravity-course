import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/user.model.js';
import { syncUser } from '../services/user.service.js';
import { logger } from '../config/logger.js';

export const clerkSession = clerkMiddleware();

export const requireAuthentication = (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      logger.warn({ auth }, 'requireAuthentication 401: No auth or userId');
      return next(new AppError('Unauthorized', 401));
    }
    // Do not overwrite req.auth to prevent breaking getAuth(req) for downstream middlewares
    next();
  } catch (err) {
    logger.warn({ err: err.message }, 'requireAuthentication 401: catch block');
    return next(new AppError('Unauthorized', 401));
  }
};

// Optional middleware to attach the local DB user to the request
export const attachLocalUser = async (req, res, next) => {
  const auth = getAuth(req);
  if (!auth || !auth.userId) {
    logger.warn('attachLocalUser 401: No auth.userId');
    return next(new AppError('Unauthorized', 401));
  }

  try {
    let user = await User.findOne({ clerkId: auth.userId });
    
    // If user does not exist locally, we can attempt to sync them right here
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        user = await syncUser(auth.userId, clerkUser);
      } catch (err) {
        logger.error({ err: err.message }, 'attachLocalUser 401: sync failed');
        return next(new AppError('User profile not found and sync failed', 401));
      }
    }
    
    req.user = user;
    next();
  } catch (err) {
    logger.error({ err: err.message }, 'attachLocalUser 500');
    next(new AppError('Failed to retrieve user', 500));
  }
};
