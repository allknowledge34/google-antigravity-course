import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { limiters } from './middleware/rateLimiter.js';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { notFound, errorHandler } from './middleware/error.js';
import healthRoutes from './routes/health.js';
import userRoutes from './routes/user.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import { messageRouter } from './routes/message.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import { clerkSession } from './middleware/auth.js';

const app = express();

// Trust proxy (e.g. Nginx / Load Balancer) to ensure correct req.ip
const trustProxy = env.TRUST_PROXY ? (isNaN(env.TRUST_PROXY) ? env.TRUST_PROXY : parseInt(env.TRUST_PROXY, 10)) : 1;
app.set("trust proxy", trustProxy);

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));

app.use(clerkSession);

app.use(
  pinoHttp({
    logger,
    autoLogging: env.NODE_ENV !== 'test',
  })
);

app.use('/api', limiters.global);

});

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRouter);
app.use('/api/v1/upload', uploadRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
