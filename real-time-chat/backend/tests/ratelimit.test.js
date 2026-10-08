import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLimiter } from '../src/middleware/rateLimiter.js';
import { checkSocketLimit } from '../src/middleware/socketRateLimiter.js';
import { getClient } from '../src/services/redis.service.js';

describe('Distributed Rate Limiting (REST & Socket)', () => {
  let redisClient;
  let app;

  beforeAll(() => {
    redisClient = getClient();
    
    app = express();
    // Dummy endpoints
    const apiLimiter = createLimiter({ windowMs: 1000, max: 2, scope: 'api_test' });
    const userLimiter = createLimiter({ windowMs: 1000, max: 2, scope: 'user_test' });

    app.use(express.json());
    
    app.post('/api/test', apiLimiter, (req, res) => res.json({ ok: true }));
    // Using a fake auth middleware to inject user id
    app.post('/api/user', (req, res, next) => {
      req.auth = { userId: req.headers['x-user-id'] };
      next();
    }, userLimiter, (req, res) => res.json({ ok: true }));
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.flushdb();
    }
  });

  it('REST: allows requests under limit', async () => {
    const res = await request(app).post('/api/test').send({});
    expect(res.status).toBe(200);
  });

  it('REST: returns 429 and Retry-After when over limit', async () => {
    await request(app).post('/api/test').send({});
    // 3rd request should fail
    const res = await request(app).post('/api/test').send({});
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.body.error).toBeDefined();
  });

  it('REST: different users have independent counters', async () => {
    // User A hits limit
    await request(app).post('/api/user').set('x-user-id', 'user_a').send({});
    await request(app).post('/api/user').set('x-user-id', 'user_a').send({});
    const resA = await request(app).post('/api/user').set('x-user-id', 'user_a').send({});
    expect(resA.status).toBe(429);

    // User B is independent
    const resB = await request(app).post('/api/user').set('x-user-id', 'user_b').send({});
    expect(resB.status).toBe(200);
  });

  it('Socket: correctly blocks socket requests over the limit and allows under', async () => {
    const res1 = await checkSocketLimit('sock_user_1', 'sock_scope', 2, 1000);
    expect(res1.allowed).toBe(true);

    const res2 = await checkSocketLimit('sock_user_1', 'sock_scope', 2, 1000);
    expect(res2.allowed).toBe(true);

    const res3 = await checkSocketLimit('sock_user_1', 'sock_scope', 2, 1000);
    expect(res3.allowed).toBe(false);
    expect(res3.resetTime).toBeDefined();
  });

  it('Socket: different scopes have independent counters', async () => {
    await checkSocketLimit('sock_user_2', 'scope_a', 1, 1000);
    const failA = await checkSocketLimit('sock_user_2', 'scope_a', 1, 1000);
    expect(failA.allowed).toBe(false);

    const passB = await checkSocketLimit('sock_user_2', 'scope_b', 1, 1000);
    expect(passB.allowed).toBe(true);
  });
});

describe('Distributed Rate Limiting (Redis Offline)', () => {

  beforeAll(async () => {
    // Override getClient in the module cache (or just mock it)
    // Actually, vitest allows vi.mock, but it might interfere with other tests running in parallel.
    // Instead, we can just test the fallback logic directly by closing the redis client or stubbing it.
  });
});
