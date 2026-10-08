import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  if (err.statusCode) {
    statusCode = err.statusCode;
  }
  
  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
