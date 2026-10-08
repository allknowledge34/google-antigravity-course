import { Router } from 'express';
import mongoose from 'mongoose';
import { checkHealth as checkRedisHealth } from '../services/redis.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const redisStatus = await checkRedisHealth();
  
  const isHealthy = dbStatus === 'up'; // We don't fail health check if Redis is down

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'API is running successfully' : 'Database unavailable',
    data: {
      uptime: process.uptime(),
      timestamp: Date.now(),
      services: {
        database: dbStatus,
        redis: redisStatus
      }
    },
  });
});

export default router;
