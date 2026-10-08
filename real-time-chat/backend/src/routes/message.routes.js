import { limiters } from '../middleware/rateLimiter.js';
import { Router } from 'express';
import * as messageController from '../controllers/message.controller.js';
import { requireAuthentication, attachLocalUser } from '../middleware/auth.js';
import { 
  validateCreateMessage, 
  validateMessageId,
  validateConversationId,
  validateEditMessage,
  validateGetMessagesQuery,
  validateReaction
} from '../validators/message.validator.js';

// We create a router that can mergeParams to get conversationId if mounted under /conversations/:conversationId/messages
// But we also need routes for /messages/:messageId for edit/delete
// So we'll define a router for /conversations/:conversationId/messages
export const conversationMessagesRouter = Router({ mergeParams: true });

conversationMessagesRouter.use(requireAuthentication, attachLocalUser);

conversationMessagesRouter.post(
  '/', limiters.messageSend, 
  validateConversationId, 
  validateCreateMessage, 
  messageController.createMessage
);

conversationMessagesRouter.get(
  '/', 
  validateConversationId, 
  validateGetMessagesQuery, 
  messageController.getMessages
);

// We define a separate router for /messages/:messageId
export const messageRouter = Router();

messageRouter.use(requireAuthentication, attachLocalUser);

messageRouter.patch(
  '/:messageId', limiters.messageSend, 
  validateMessageId, 
  validateEditMessage, 
  messageController.editMessage
);

messageRouter.delete(
  '/:messageId', limiters.messageSend, 
  validateMessageId, 
  messageController.deleteMessage
);

messageRouter.post(
  '/:messageId/reactions', limiters.messageSend,
  validateMessageId,
  validateReaction,
  messageController.addReaction
);

messageRouter.delete(
  '/:messageId/reactions', limiters.messageSend,
  validateMessageId,
  validateReaction,
  messageController.removeReaction
);
