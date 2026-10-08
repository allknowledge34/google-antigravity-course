import { limiters } from '../middleware/rateLimiter.js';
import { Router } from 'express';
import * as conversationController from '../controllers/conversation.controller.js';
import { requireAuthentication, attachLocalUser } from '../middleware/auth.js';
import { 
  validateCreateConversation, 
  validateConversationId, 
  validateAddMember, 
  validateRemoveMember 
} from '../validators/conversation.validator.js';
import { conversationMessagesRouter } from './message.routes.js';

const router = Router();

// All conversation routes require authentication AND the local User object
router.use(requireAuthentication, attachLocalUser);

router.use('/:conversationId/messages', conversationMessagesRouter);

router.post('/', limiters.groupCreate, validateCreateConversation, conversationController.createConversation);
router.get('/', conversationController.getConversations);

router.get('/:conversationId', validateConversationId, conversationController.getConversationDetails);

router.post('/:conversationId/members', limiters.groupCreate, validateConversationId, validateAddMember, conversationController.addMember);
router.delete('/:conversationId/members/:userId', limiters.groupCreate, validateConversationId, validateRemoveMember, conversationController.removeMember);

router.post('/:conversationId/leave', validateConversationId, conversationController.leaveConversation);

export default router;
