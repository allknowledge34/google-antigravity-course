import { asyncHandler } from '../utils/asyncHandler.js';
import * as conversationService from '../services/conversation.service.js';

export const createConversation = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { type } = req.body;

  let conversation;
  if (type === 'direct') {
    conversation = await conversationService.createDirectConversation(currentUser, req.body.memberId);
  } else {
    conversation = await conversationService.createGroupConversation(currentUser, req.body.name, req.body.avatar, req.body.memberIds);
  }

  // Use 201 for creation, though direct might return an existing 200... but 201 is fine generally as per instructions or 201 for newly created
  res.status(201).json({
    success: true,
    data: conversation
  });
});

export const getConversations = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const conversations = await conversationService.getUserConversations(currentUser._id);

  res.status(200).json({
    success: true,
    data: conversations
  });
});

export const getConversationDetails = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId } = req.params;

  const conversation = await conversationService.getConversationDetails(conversationId, currentUser._id);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

export const addMember = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId } = req.params;
  const { memberId } = req.body;

  const conversation = await conversationService.addMember(conversationId, currentUser._id, memberId);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

export const removeMember = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId, userId } = req.params;

  const conversation = await conversationService.removeMember(conversationId, currentUser._id, userId);

  res.status(200).json({
    success: true,
    data: conversation
  });
});

export const leaveConversation = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { conversationId } = req.params;

  await conversationService.leaveConversation(conversationId, currentUser._id);

  res.status(200).json({
    success: true,
    message: 'Left conversation successfully'
  });
});
