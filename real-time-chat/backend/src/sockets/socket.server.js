import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { EVENTS } from './socket.events.js';
import { registerConversationHandlers } from './handlers/conversation.handler.js';
import { registerMessageHandlers } from './handlers/message.handler.js';
import { registerPresenceHandlers } from './handlers/presence.handler.js';
import { registerTypingHandlers } from './handlers/typing.handler.js';

import { presenceManager } from './presence.manager.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { getPubClient, getSubClient } from '../services/redis.service.js';

let io;

export const initSocketServer = (httpServer) => {
  
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    }
  });

  const pubClient = getPubClient();
  const subClient = getSubClient();
  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter attached');
  } else {
    logger.info('Socket.IO running in memory (Redis adapter disabled)');
  }

  io.use(socketAuthMiddleware);


  io.on(EVENTS.CONNECTION, async (socket) => {
    logger.info({ userId: socket.user._id }, 'Client connected to socket');
    
    // Join personal user room for global presence/messages
    socket.join(`user:${socket.user._id.toString()}`);

    // Handle presence
    await presenceManager.handleConnect(io, socket.user._id);

    registerConversationHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerTypingHandlers(io, socket);

    socket.on(EVENTS.DISCONNECT, async () => {
      logger.info({ userId: socket.user._id }, 'Client disconnected from socket');
      await presenceManager.handleDisconnect(io, socket.user._id);
    });

    socket.on(EVENTS.CONNECT_ERROR, (err) => {
      logger.error({ err, userId: socket.user?._id }, 'Socket connect error');
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    // For test environments where HTTP server isn't started
    const mockRoom = { 
      emit: () => {},
      socketsLeave: () => {}
    };
    return {
      to: () => mockRoom,
      in: () => mockRoom,
      emit: () => {}
    };
  }
  return io;
};
