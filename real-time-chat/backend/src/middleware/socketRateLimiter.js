import { getClient } from '../services/redis.service.js';
import { logger } from '../config/logger.js';
import { EVENTS } from '../sockets/socket.events.js';

// Simple in-memory fallback store for sockets
const memoryStore = new Map();

const cleanMemoryStore = () => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
};
/* global setInterval */
setInterval(cleanMemoryStore, 60000).unref();

export const checkSocketLimit = async (userId, scope, max, windowMs) => {
  
  const key = `chat:rate-limit:socket:${scope}:${userId}`;
  const redis = getClient();
  
  if (!redis || redis.status !== 'ready') {
    // Fallback to memory
    const now = Date.now();
    let record = memoryStore.get(key);
    if (!record || record.resetTime < now) {
      record = { count: 0, resetTime: now + windowMs };
    }
    record.count++;
    memoryStore.set(key, record);
    
    return {
      allowed: record.count <= max,
      totalHits: record.count,
      resetTime: record.resetTime
    };
  }

  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = await multi.exec();
    
    let count = results[0][1];
    let ttl = results[1][1];
    
    if (count === 1 || ttl === -1) {
      await redis.pexpire(key, windowMs);
      ttl = windowMs;
    }
    
    return {
      allowed: count <= max,
      totalHits: count,
      resetTime: Date.now() + (ttl > 0 ? ttl : windowMs)
    };
  } catch (err) {
    logger.warn({ errCode: err.code, key }, 'Socket rate limit redis failed, assuming allowed');
    return { allowed: true };
  }
};

export const withSocketRateLimit = (options, handler) => {
  return async function (payload, ...args) {
    // 'this' is the socket instance in socket.io handlers
    const socket = this;
    const userId = socket.user?._id?.toString() || socket.id;
    
    const result = await checkSocketLimit(userId, options.scope, options.max, options.windowMs);
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      logger.warn({ userId, scope: options.scope, retryAfter }, 'Socket rate limit exceeded');
      
      socket.emit(options.errorEvent || EVENTS.MESSAGE_ERROR, {
        error: options.message || 'Too many requests, please try again later.',
        retryAfter
      });
      return;
    }
    
    return handler.call(socket, payload, ...args);
  };
};

export const socketLimits = {
  message: { scope: 'messageSend', max: 60, windowMs: 60 * 1000, errorEvent: EVENTS.MESSAGE_ERROR },
  typing: { scope: 'typing', max: 120, windowMs: 60 * 1000, errorEvent: EVENTS.MESSAGE_ERROR },
  receipts: { scope: 'receipts', max: 200, windowMs: 60 * 1000, errorEvent: EVENTS.MESSAGE_ERROR },
  conversation: { scope: 'conversation', max: 30, windowMs: 60 * 1000, errorEvent: EVENTS.CONVERSATION_ERROR }
};
