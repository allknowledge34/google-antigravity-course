import { EVENTS } from '../socket.events.js';
import { ConversationMember } from '../../models/conversationMember.model.js';
import { logger } from '../../config/logger.js';
import { withSocketRateLimit, socketLimits } from '../../middleware/socketRateLimiter.js';

export const registerTypingHandlers = (io, socket) => {
  socket.on(EVENTS.TYPING_START, withSocketRateLimit(socketLimits.typing, async ({ conversationId }) => {
    try {
      if (!conversationId) return;
      const isMember = await ConversationMember.exists({
        conversationId,
        userId: socket.user._id
      });
      if (!isMember) return;
      socket.to(`conversation:${conversationId}`).emit(EVENTS.TYPING_START, {
        conversationId,
        userId: socket.user._id.toString()
      });
    } catch (error) {
      logger.error({ err: error, conversationId }, 'Error handling typing:start');
    }
  }));

  socket.on(EVENTS.TYPING_STOP, withSocketRateLimit(socketLimits.typing, async ({ conversationId }) => {
    try {
      if (!conversationId) return;
      const isMember = await ConversationMember.exists({
        conversationId,
        userId: socket.user._id
      });
      if (!isMember) return;
      socket.to(`conversation:${conversationId}`).emit(EVENTS.TYPING_STOP, {
        conversationId,
        userId: socket.user._id.toString()
      });
    } catch (error) {
      logger.error({ err: error, conversationId }, 'Error handling typing:stop');
    }
  }));
};
