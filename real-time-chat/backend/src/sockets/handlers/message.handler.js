import { EVENTS } from '../socket.events.js';
import { createMessage } from '../../services/message.service.js';
import { logger } from '../../config/logger.js';
import { withSocketRateLimit, socketLimits } from '../../middleware/socketRateLimiter.js';

export const registerMessageHandlers = (io, socket) => {
  socket.on(EVENTS.MESSAGE_SEND, withSocketRateLimit(socketLimits.message, async (payload) => {
    try {
      const { conversationId, clientMessageId, content, type, replyTo, attachment } = payload;
      
      if (!conversationId || !clientMessageId || !content) {
        return socket.emit(EVENTS.MESSAGE_ERROR, { 
          message: 'Missing required fields',
          clientMessageId 
        });
      }

      // We call the existing business logic directly.
      // createMessage handles checking duplicate clientMessageId and checking authorization membership.
      const canonicalMessage = await createMessage(socket.user._id, conversationId, {
        clientMessageId,
        content,
        type,
        replyTo,
        attachment
      });

      const roomName = `conversation:${conversationId}`;
      
      // Emit back to the whole room (including sender to reconcile)
      io.to(roomName).emit(EVENTS.MESSAGE_NEW, canonicalMessage);
      
      // Notify other members globally for unread badge updates
      const { ConversationMember } = await import('../../models/conversationMember.model.js');
      const members = await ConversationMember.find({ conversationId }).lean();
      for (const member of members) {
        if (member.userId.toString() !== socket.user._id.toString()) {
          io.to(`user:${member.userId.toString()}`).emit('conversation:unread', {
            conversationId,
            messageId: canonicalMessage._id,
            content: canonicalMessage.type === 'text' ? canonicalMessage.content : `[${canonicalMessage.type}]`,
            createdAt: canonicalMessage.createdAt,
            type: canonicalMessage.type,
            senderId: canonicalMessage.senderId
          });
        }
      }
      
    } catch (error) {
      if (error.statusCode === 403 || error.statusCode === 404 || error.statusCode === 400) {
        return socket.emit(EVENTS.MESSAGE_ERROR, { 
          message: error.message,
          clientMessageId: payload.clientMessageId
        });
      }
      
      logger.error({ err: error, payload }, 'Failed to process message:send event');
      socket.emit(EVENTS.MESSAGE_ERROR, { 
        message: 'Internal server error',
        clientMessageId: payload.clientMessageId
      });
    }
  }));

  socket.on(EVENTS.MESSAGE_DELIVERED, withSocketRateLimit(socketLimits.receipts, async ({ conversationId, messageId }) => {
    try {
      if (!conversationId || !messageId) return;
      const { updateReceipt } = await import('../../services/conversation.service.js');
      await updateReceipt(socket.user._id, conversationId, messageId, 'delivered');
      io.to(`conversation:${conversationId}`).emit(EVENTS.RECEIPT_UPDATED, {
        conversationId,
        userId: socket.user._id,
        lastDeliveredMessageId: messageId,
        messageId,
        type: 'delivered'
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to process message:delivered');
    }
  }));

  socket.on(EVENTS.MESSAGE_READ, withSocketRateLimit(socketLimits.receipts, async ({ conversationId, messageId }) => {
    try {
      if (!conversationId || !messageId) return;
      const { updateReceipt } = await import('../../services/conversation.service.js');
      await updateReceipt(socket.user._id, conversationId, messageId, 'read');
      io.to(`conversation:${conversationId}`).emit(EVENTS.RECEIPT_UPDATED, {
        conversationId,
        userId: socket.user._id,
        lastReadMessageId: messageId,
        messageId,
        type: 'read'
      });
      io.to(`user:${socket.user._id.toString()}`).emit('conversation:read', {
        conversationId,
        messageId
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to process message:read');
    }
  }));
};
