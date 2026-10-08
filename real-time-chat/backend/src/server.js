import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import mongoose from 'mongoose';
import { initSocketServer } from './sockets/socket.server.js';
import { closeRedis } from './services/redis.service.js';

const server = http.createServer(app);

// Initialize Socket.IO
initSocketServer(server);

const startServer = async () => {
  try {
     await connectDB(); 
    
    server.listen(env.PORT, "0.0.0.0", () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled Rejection');
  server.close(async () => {
    await closeRedis();
    await mongoose.disconnect();
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(async () => {
    await closeRedis();
    await mongoose.disconnect();
    process.exit(0);
  });
});
