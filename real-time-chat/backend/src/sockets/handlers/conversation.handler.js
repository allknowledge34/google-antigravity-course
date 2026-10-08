import { EVENTS } from '../socket.events.js';
import { ConversationMember } from '../../models/conversationMember.model.js';
import { logger } from '../../config/logger.js';
import { withSocketRateLimit, socketLimits } from '../../middleware/socketRateLimiter.js';

export const registerConversationHandlers = (io, socket) => {
  socket.on(EVENTS.CONVERSATION_JOIN, withSocketRateLimit(socketLimits.conversation, async ({ conversationId }) => {
    try {
      if (!conversationId) return;

      const isMember = await ConversationMember.exists({
        conversationId,
        userId: socket.user._id,
      });

      if (!isMember) {
        return socket.emit(EVENTS.CONVERSATION_ERROR, { message: 'Unauthorized to join this conversation' });
      }

      socket.join(`conversation:${conversationId}`);
    } catch (error) {
      logger.error({ err: error, conversationId }, 'Error handling conversation:join');
    }
  }));

  socket.on(EVENTS.CONVERSATION_LEAVE, withSocketRateLimit(socketLimits.conversation, async ({ conversationId }) => {
    try {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    } catch (error) {
      logger.error({ err: error, conversationId }, 'Error handling conversation:leave');
    }
  }));
};
