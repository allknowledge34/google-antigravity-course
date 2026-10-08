import { Message } from '../models/message.model.js';
import { Conversation } from '../models/conversation.model.js';
import { ConversationMember } from '../models/conversationMember.model.js';
import { MessageReaction } from '../models/messageReaction.model.js';
import { AppError } from '../utils/AppError.js';
import { del, incrIfExists } from './redis.service.js';
import { CACHE_KEYS } from '../config/redis.keys.js';

const checkMembership = async (conversationId, userId) => {
  const member = await ConversationMember.findOne({ conversationId, userId });
  if (!member) {
    throw new AppError('Forbidden: Not a member of this conversation', 403);
  }
  return member;
};

export const createMessage = async (userId, conversationId, data) => {
  await checkMembership(conversationId, userId);

  const { clientMessageId, content, type, replyTo, attachment } = data;

  if (replyTo) {
    const originalMessage = await Message.findById(replyTo);
    if (!originalMessage) {
      throw new AppError('Reply target message not found', 404);
    }
    if (originalMessage.conversationId.toString() !== conversationId.toString()) {
      throw new AppError('Cannot reply to a message from a different conversation', 400);
    }
  }

  let message;
  try {
    message = await Message.create({
      conversationId,
      senderId: userId,
      clientMessageId,
      content,
      type: type || 'text',
      replyTo: replyTo || null,
      attachment: attachment || null,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate clientMessageId
      const existingMessage = await Message.findOne({
        conversationId,
        senderId: userId,
        clientMessageId,
      }).populate('senderId', 'username displayName avatar');
      return existingMessage;
    }
    throw error;
  }

  const populatedMessage = await message.populate('senderId', 'username displayName avatar clerkId');

  // Update conversation lastMessage asynchronously
  const preview = {
    messageId: message._id,
    senderId: userId,
    content: message.type === 'text' ? message.content : `[${message.type}]`,
    type: message.type,
    createdAt: message.createdAt
  };

  await del(CACHE_KEYS.CONVERSATION_DETAILS(conversationId));
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: preview,
        lastMessageAt: message.createdAt
      }
    }
  );


  // Increment unread counts in Redis for other members (if key exists, cache-aside)
  const members = await ConversationMember.find({ conversationId }).lean();
  for (const member of members) {
    if (member.userId.toString() !== userId.toString()) {
      await incrIfExists(CACHE_KEYS.UNREAD_COUNT(member.userId, conversationId));
    }
  }

  return populatedMessage;
};

export const getMessages = async (userId, conversationId, limit = 50, before) => {
  await checkMembership(conversationId, userId);

  const query = { conversationId };

  if (before) {
    query._id = { $lt: before };
  }

  // Cap limit
  const maxLimit = 100;
  const safeLimit = Math.min(Math.max(1, limit), maxLimit);

  // We sort by _id descending to get the most recent messages first,
  // then we reverse them in memory to return chronological order.

  const messages = await Message.find(query)
    .sort({ _id: -1 })
    .limit(safeLimit + 1)
    .populate('senderId', 'username displayName avatar clerkId')
    .lean();

  const messageIds = messages.map(m => m._id);
  const reactions = await MessageReaction.find({ messageId: { $in: messageIds } }).lean();

  const reactionsByMessageId = {};
  reactions.forEach(r => {
    if (!reactionsByMessageId[r.messageId]) {
      reactionsByMessageId[r.messageId] = [];
    }
    reactionsByMessageId[r.messageId].push({
      userId: r.userId,
      emoji: r.emoji
    });
  });


  const hasMore = messages.length > safeLimit;
  if (hasMore) {
    messages.pop(); // Remove the extra item
  }

  // Apply deletion masking
  const processedMessages = messages.map(msg => {
    if (msg.deletedAt) {
      msg.content = '';
      msg.type = 'system'; // Or just keep it empty but flag it
    }
    msg.reactions = reactionsByMessageId[msg._id] || [];
    return msg;
  });

  processedMessages.reverse();

  return {
    messages: processedMessages,
    hasMore,
    nextCursor: processedMessages.length > 0 ? processedMessages[0]._id : null
  };
};

export const editMessage = async (userId, messageId, content) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError('Message not found', 404);
  }
  if (message.senderId.toString() !== userId.toString()) {
    throw new AppError('Forbidden: Can only edit your own messages', 403);
  }
  if (message.deletedAt) {
    throw new AppError('Cannot edit a deleted message', 400);
  }

  message.content = content;
  message.editedAt = new Date();
  await message.save();

  return message.populate('senderId', 'username displayName avatar clerkId');
};

export const deleteMessage = async (userId, messageId) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError('Message not found', 404);
  }
  if (message.senderId.toString() !== userId.toString()) {
    throw new AppError('Forbidden: Can only delete your own messages', 403);
  }
  if (message.deletedAt) {
    return message; // Idempotent
  }

  message.deletedAt = new Date();
  await message.save();

  return message;
};


export const addReaction = async (userId, messageId, emoji) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  
  await checkMembership(message.conversationId, userId);
  
  let reaction;
  try {
    reaction = await MessageReaction.create({
      messageId,
      userId,
      emoji
    });
  } catch (error) {
    if (error.code === 11000) {
      reaction = await MessageReaction.findOne({ messageId, userId, emoji });
    } else {
      throw error;
    }
  }
  
  return { message, reaction };
};

export const removeReaction = async (userId, messageId, emoji) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError('Message not found', 404);
  
  await checkMembership(message.conversationId, userId);
  
  await MessageReaction.findOneAndDelete({ messageId, userId, emoji });
  
  return { message };
};
