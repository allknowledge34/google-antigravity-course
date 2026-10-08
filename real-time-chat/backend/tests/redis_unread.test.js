import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { CACHE_KEYS } from '../src/config/redis.keys.js';
import * as redisService from '../src/services/redis.service.js';

describe('Redis Unread Operations', () => {
  const isRedisAvailable = !!redisService.getClient();

  beforeEach(async () => {
    if (isRedisAvailable) {
      await redisService.getClient().flushall();
    }
  });

  afterAll(async () => {
    if (isRedisAvailable) {
      await redisService.getClient().flushall();
      await redisService.closeRedis();
    }
  });

  it('incrIfExists should handle missing key gracefully', async () => {
    const key = CACHE_KEYS.UNREAD_COUNT('userA', 'convA');
    const result = await redisService.incrIfExists(key);
    expect(result).toBe(false);
    
    const count = await redisService.getInt(key);
    expect(count).toBeNull();
  });

  it('incrIfExists should increment existing key or fail gracefully if disabled', async () => {
    const key = CACHE_KEYS.UNREAD_COUNT('userB', 'convB');
    const setRes = await redisService.setInt(key, 5, 300);
    
    const result = await redisService.incrIfExists(key);
    const count = await redisService.getInt(key);

    if (isRedisAvailable) {
      expect(setRes).toBe(true);
      expect(result).toBe(true);
      expect(count).toBe(6);
    } else {
      expect(setRes).toBe(false);
      expect(result).toBe(false);
      expect(count).toBeNull();
    }
  });
});
