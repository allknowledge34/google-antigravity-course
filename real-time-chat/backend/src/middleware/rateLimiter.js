import rateLimit, { MemoryStore } from 'express-rate-limit';
import { getClient } from '../services/redis.service.js';
import { logger } from '../config/logger.js';

export class RedisFallbackStore {
  constructor() {
    this.memoryStore = new MemoryStore();
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.memoryStore.init(options);
  }

  async increment(key) {
    const redis = getClient();
    // Fall back to memory if redis is missing or disconnected
    if (!redis || redis.status !== 'ready') {
      return this.memoryStore.increment(key);
    }
    
    try {
      const rKey = `chat:rate-limit:${key}`;
      const multi = redis.multi();
      multi.incr(rKey);
      multi.pttl(rKey);
      const results = await multi.exec();
      
      let count = results[0][1];
      let ttl = results[1][1];
      
      if (count === 1 || ttl === -1) {
        await redis.pexpire(rKey, this.windowMs);
        ttl = this.windowMs;
      }
      
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
      return { totalHits: count, resetTime };
    } catch (_err) {
      
      logger.warn({ errCode: _err.code, key }, 'Redis rate-limit increment failed, falling back to memory');
      return this.memoryStore.increment(key);
    }
  }

  async decrement(key) {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') {
      return this.memoryStore.decrement(key);
    }
    try {
      const rKey = `chat:rate-limit:${key}`;
      await redis.decr(rKey);
    } catch {
      
      this.memoryStore.decrement(key);
    }
  }

  async resetKey(key) {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') {
      return this.memoryStore.resetKey(key);
    }
    try {
      const rKey = `chat:rate-limit:${key}`;
      await redis.del(rKey);
    } catch {
      
      this.memoryStore.resetKey(key);
    }
  }
}

export const createLimiter = (options) => {
  
  return rateLimit({
    store: new RedisFallbackStore(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Identity strategy: Authenticated user preferred, else IP
      const userId = req.auth?.userId || req.user?.id || req.user?._id;
      const id = userId ? userId.toString() : req.ip;
      return `${options.scope || 'global'}:${id}`;
    },
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        error: options.message || 'Too many requests, please try again later.'
      });
    },
    ...options,
  });
};

export const limiters = {
  global: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    scope: 'global'
  }),
  search: createLimiter({
    windowMs: 60 * 1000,
    max: 30, // 30 per minute
    scope: 'search'
  }),
  messageSend: createLimiter({
    windowMs: 60 * 1000,
    max: 60, // 60 messages per minute
    scope: 'messageSend'
  }),
  groupCreate: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    scope: 'groupCreate'
  }),
  profileUpdate: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    scope: 'profileUpdate'
  })
};
