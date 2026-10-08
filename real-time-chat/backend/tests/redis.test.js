import { describe, it, expect } from 'vitest';
import * as redisService from '../src/services/redis.service.js';

describe('Redis Service', () => {
  it('should handle getJson and setJson when disabled', async () => {
    // Current environment does not have REDIS_URL in vitest by default
    // so redisClient will be null.
    expect(redisService.getClient()).toBeNull();
    
    const result = await redisService.setJson('test', { a: 1 }, 10);
    expect(result).toBe(false);
    
    const data = await redisService.getJson('test');
    expect(data).toBeNull();
  });

  it('health check should return disabled', async () => {
    const status = await redisService.checkHealth();
    expect(status).toBe('disabled');
  });
  
  it('delete should gracefully fail', async () => {
    const result = await redisService.del('test');
    expect(result).toBe(false);
  });
});
