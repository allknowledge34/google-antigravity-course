import { asyncHandler } from '../utils/asyncHandler.js';
import * as messageService from '../services/message.service.js';
import { getIO } from '../sockets/socket.server.js';
import { EVENTS } from '../sockets/socket.events.js';

export const createMessage = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId } = req.params;
  
  const message = await messageService.createMessage(currentUser._id, conversationId, req.body);

  res.status(201).json({
    success: true,
    data: message
  });
});

export const getMessages = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId } = req.params;
  const { limit, before } = req.validatedQuery;

  const result = await messageService.getMessages(currentUser._id, conversationId, limit, before);

  res.status(200).json({
    success: true,
    data: result.messages,
    meta: {
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
    }
  });
});

export const editMessage = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { messageId } = req.params;
  const { content } = req.body;

  const message = await messageService.editMessage(currentUser._id, messageId, content);

  const io = getIO();
  io.to(`conversation:${message.conversationId}`).emit(EVENTS.MESSAGE_UPDATED, message);

  res.status(200).json({
    success: true,
    data: message
  });
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { messageId } = req.params;

  const message = await messageService.deleteMessage(currentUser._id, messageId);

  // Mask the content before broadcasting the delete
  const safeMessage = {
    ...message.toObject(),
    content: '',
    type: 'system', 
  };

  const io = getIO();
  io.to(`conversation:${message.conversationId}`).emit(EVENTS.MESSAGE_DELETED, safeMessage);

  res.status(200).json({
    success: true,
    data: message
  });
});

export const addReaction = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { messageId } = req.params;
  const { emoji } = req.body;

  const { message, reaction } = await messageService.addReaction(currentUser._id, messageId, emoji);

  const io = getIO();
  io.to(`conversation:${message.conversationId}`).emit(EVENTS.REACTION_ADD, {
    messageId,
    reaction: {
      userId: currentUser._id,
      emoji
    }
  });

  res.status(200).json({ success: true, data: reaction });
});

export const removeReaction = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { messageId } = req.params;
  const { emoji } = req.body;

  const { message } = await messageService.removeReaction(currentUser._id, messageId, emoji);

  const io = getIO();
  io.to(`conversation:${message.conversationId}`).emit(EVENTS.REACTION_REMOVE, {
    messageId,
    reaction: {
      userId: currentUser._id,
      emoji
    }
  });

  res.status(200).json({ success: true });
});
