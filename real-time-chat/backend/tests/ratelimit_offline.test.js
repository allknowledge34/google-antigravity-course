import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLimiter } from '../src/middleware/rateLimiter.js';
import { checkSocketLimit } from '../src/middleware/socketRateLimiter.js';

vi.mock('../src/services/redis.service.js', () => ({
  getClient: vi.fn(() => ({ status: 'end' })) // Simulate disconnected redis
}));

describe('Rate Limiter (Fallback Mode)', () => {
  let app;

  beforeAll(() => {
    app = express();
    const limiter = createLimiter({ windowMs: 1000, max: 1, scope: 'offline_test' });
    app.post('/api/offline', limiter, (req, res) => res.json({ ok: true }));
  });

  it('REST: fallback memory store allows and blocks requests correctly', async () => {
    const res1 = await request(app).post('/api/offline');
    expect(res1.status).toBe(200);

    const res2 = await request(app).post('/api/offline');
    expect(res2.status).toBe(429);
  });

  it('Socket: fallback memory store allows and blocks requests correctly', async () => {
    const res1 = await checkSocketLimit('off_user', 'off_scope', 1, 1000);
    expect(res1.allowed).toBe(true);

    const res2 = await checkSocketLimit('off_user', 'off_scope', 1, 1000);
    expect(res2.allowed).toBe(false);
  });
});
