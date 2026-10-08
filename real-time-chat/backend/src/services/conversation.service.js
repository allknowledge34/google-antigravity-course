import { Conversation } from '../models/conversation.model.js';
import { ConversationMember } from '../models/conversationMember.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/socket.server.js';
import { getJson, setJson, del, getInt, setInt } from './redis.service.js';
import { CACHE_KEYS, CACHE_TTL } from '../config/redis.keys.js';

const generateDirectConversationKey = (user1Id, user2Id) => {
  const ids = [user1Id.toString(), user2Id.toString()].sort();
  return `${ids[0]}_${ids[1]}`;
};

export const createDirectConversation = async (currentUser, targetUserId) => {
  if (currentUser._id.toString() === targetUserId.toString()) {
    throw new AppError('Cannot create a direct conversation with yourself', 400);
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError('Target user not found', 404);
  }

  const directKey = generateDirectConversationKey(currentUser._id, targetUser._id);

  // Try to find existing
  let conversation = await Conversation.findOne({ directConversationKey: directKey });
  if (conversation) {
    return getConversationDetails(conversation._id, currentUser._id);
  }

  let newConv;
  try {
    newConv = await Conversation.create({
      type: 'direct',
      createdBy: currentUser._id,
      directConversationKey: directKey
    });

    await ConversationMember.create([
      { conversationId: newConv._id, userId: currentUser._id, role: 'member' },
      { conversationId: newConv._id, userId: targetUser._id, role: 'member' }
    ]);
  } catch (error) {
    if (newConv) {
      // Rollback
      await Conversation.deleteOne({ _id: newConv._id });
      await ConversationMember.deleteMany({ conversationId: newConv._id });
    }
    
    if (error.code === 11000) {
      // Duplicate key error, another request created it just now
      const existing = await Conversation.findOne({ directConversationKey: directKey });
      if (existing) {
        return getConversationDetails(existing._id, currentUser._id);
      }
    }
    throw error;
  }

  return getConversationDetails(newConv._id, currentUser._id);
};

export const createGroupConversation = async (currentUser, name, avatar, memberIds) => {
  // Filter unique valid member IDs excluding creator
  const uniqueMemberIds = [...new Set(memberIds)].filter(id => id.toString() !== currentUser._id.toString());
  
  if (uniqueMemberIds.length === 0) {
    throw new AppError('Group must have at least one other member', 400);
  }

  const users = await User.find({ _id: { $in: uniqueMemberIds } });
  if (users.length !== uniqueMemberIds.length) {
    throw new AppError('One or more users not found', 404);
  }

  let newConv;
  try {
    newConv = await Conversation.create({
      type: 'group',
      name: name,
      avatar: avatar || '',
      createdBy: currentUser._id
    });

    const membersToCreate = [
      { conversationId: newConv._id, userId: currentUser._id, role: 'owner' },
      ...users.map(u => ({ conversationId: newConv._id, userId: u._id, role: 'member' }))
    ];

    await ConversationMember.create(membersToCreate);
  } catch (error) {
    if (newConv) {
      await Conversation.deleteOne({ _id: newConv._id });
      await ConversationMember.deleteMany({ conversationId: newConv._id });
    }
    throw error;
  }

  return getConversationDetails(newConv._id, currentUser._id);
};

export const getUserConversations = async (userId) => {
  const memberships = await ConversationMember.find({ userId }).select('conversationId role');
  const convIds = memberships.map(m => m.conversationId);

  const conversations = await Conversation.find({ _id: { $in: convIds } }).sort({ updatedAt: -1 }).lean();
  
  // We need to provide basic member info, at least the other user for direct chats
  const allMemberships = await ConversationMember.find({ conversationId: { $in: convIds } }).populate('userId', 'username displayName avatar clerkId').lean();

  const results = [];
  const seenDirectKeys = new Set();

  for (const conv of conversations) {
    const members = allMemberships.filter(m => m.conversationId.toString() === conv._id.toString());
    const currentUserMembership = members.find(m => m.userId._id.toString() === userId.toString());
    
    let convName = conv.name;
    let convAvatar = conv.avatar;

    if (conv.type === 'direct') {
      // Deduplicate direct conversations on the fly based on members
      const otherMember = members.find(m => m.userId._id.toString() !== userId.toString());
      if (otherMember && otherMember.userId) {
        const ids = [userId.toString(), otherMember.userId._id.toString()].sort();
        const directKey = `${ids[0]}_${ids[1]}`;
        
        if (seenDirectKeys.has(directKey)) {
          // Already have a newer canonical conversation for this pair (conversations are sorted by updatedAt descending)
          continue;
        }
        seenDirectKeys.add(directKey);
        
        convName = otherMember.userId.displayName;
        convAvatar = otherMember.userId.avatar;
      }
    }

    results.push({
      _id: conv._id,
      type: conv.type,
      name: convName,
      avatar: convAvatar,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      role: currentUserMembership?.role,
      members: members.map(m => ({
        _id: m.userId._id,
        clerkId: m.userId.clerkId,
        username: m.userId.username,
        displayName: m.userId.displayName,
        avatar: m.userId.avatar,
        role: m.role,
        lastReadMessageId: m.lastReadMessageId,
        lastDeliveredMessageId: m.lastDeliveredMessageId
      }))
    });
  }


  // Compute unread counts using Redis cache-aside with Promise.all
  await Promise.all(results.map(async (res) => {
    const mem = allMemberships.find(m => m.conversationId.toString() === res._id.toString() && m.userId._id.toString() === userId.toString());
    const lastRead = mem?.lastReadMessageId;
    
    const unreadKey = CACHE_KEYS.UNREAD_COUNT(userId, res._id);
    let count = await getInt(unreadKey);

    if (count === null || isNaN(count) || count < 0) {
      const query = {
        conversationId: res._id,
        senderId: { $ne: userId }
      };
      
      if (lastRead) {
        query._id = { $gt: lastRead };
      }
      
      count = await Message.countDocuments(query);
      if (count >= 0) {
        await setInt(unreadKey, count, CACHE_TTL.LONG);
      }
    }
    
    res.unreadCount = Math.max(0, count || 0);
  }));

  return results;
};

export const getConversationDetails = async (conversationId, userId) => {
  const isMember = await ConversationMember.findOne({ conversationId, userId });
  if (!isMember) {
    throw new AppError('Forbidden', 403);
  }

  const convKey = CACHE_KEYS.CONVERSATION_DETAILS(conversationId);
  let conversation = await getJson(convKey);
  
  if (!conversation) {
    conversation = await Conversation.findById(conversationId).populate('createdBy', 'username displayName avatar').lean();
    if (conversation) {
      await setJson(convKey, conversation, CACHE_TTL.SHORT);
    }
  }

  if (!conversation) {
    throw new AppError('Conversation not found', 404);
  }

  // Not caching members here because they contain highly mutable read receipts
  const members = await ConversationMember.find({ conversationId }).populate('userId', 'username displayName avatar clerkId').lean();

  let convName = conversation.name;
  let convAvatar = conversation.avatar;

  if (conversation.type === 'direct') {
    const otherMember = members.find(m => m.userId._id.toString() !== userId.toString());
    if (otherMember && otherMember.userId) {
      convName = otherMember.userId.displayName;
      convAvatar = otherMember.userId.avatar;
    }
  }

  return {
    _id: conversation._id,
    type: conversation.type,
    name: convName,
    avatar: convAvatar,
    createdBy: conversation.createdBy,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    currentUserRole: isMember.role,
    members: members.map(m => ({
      _id: m.userId._id,
      clerkId: m.userId.clerkId,
      username: m.userId.username,
      displayName: m.userId.displayName,
      avatar: m.userId.avatar,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadMessageId: m.lastReadMessageId,
      lastDeliveredMessageId: m.lastDeliveredMessageId
    }))
  };
};

export const addMember = async (conversationId, currentUserId, targetUserId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.type !== 'group') throw new AppError('Cannot add members to a direct conversation', 400);

  const requester = await ConversationMember.findOne({ conversationId, userId: currentUserId });
  if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
    throw new AppError('Only owner or admin can add members', 403);
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) throw new AppError('Target user not found', 404);

  const existingMember = await ConversationMember.findOne({ conversationId, userId: targetUserId });
  if (existingMember) throw new AppError('User is already a member', 400);

  await ConversationMember.create({ conversationId, userId: targetUserId, role: 'member' });
  return getConversationDetails(conversationId, currentUserId);
};

export const removeMember = async (conversationId, currentUserId, targetUserId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.type !== 'group') throw new AppError('Cannot remove members from a direct conversation', 400);

  if (currentUserId.toString() === targetUserId.toString()) {
    throw new AppError('Use the leave endpoint to remove yourself', 400);
  }

  const requester = await ConversationMember.findOne({ conversationId, userId: currentUserId });
  if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
    throw new AppError('Only owner or admin can remove members', 403);
  }

  const targetMember = await ConversationMember.findOne({ conversationId, userId: targetUserId });
  if (!targetMember) throw new AppError('Member not found in conversation', 404);
  if (targetMember.role === 'owner') {
    throw new AppError('Cannot remove the group owner', 400);
  }

  await ConversationMember.deleteOne({ _id: targetMember._id });
  await del(CACHE_KEYS.UNREAD_COUNT(targetUserId, conversationId));
  const io = getIO();
  io.in(`user:${targetUserId.toString()}`).socketsLeave(`conversation:${conversationId.toString()}`);
  return getConversationDetails(conversationId, currentUserId);
};

export const leaveConversation = async (conversationId, currentUserId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new AppError('Conversation not found', 404);
  if (conversation.type !== 'group') throw new AppError('Cannot leave a direct conversation', 400);

  const member = await ConversationMember.findOne({ conversationId, userId: currentUserId });
  if (!member) throw new AppError('You are not a member', 404);

  if (member.role === 'owner') {
    // Check if there are other members
    const otherMembers = await ConversationMember.find({ conversationId, userId: { $ne: currentUserId } }).sort({ joinedAt: 1 });
    if (otherMembers.length === 0) {
      throw new AppError('Owner cannot leave as the only member. Delete the group instead.', 400); // We don't have delete group yet, so just reject for now.
    }
    
    // Transfer ownership to the oldest admin, or oldest member
    let nextOwner = otherMembers.find(m => m.role === 'admin');
    if (!nextOwner) nextOwner = otherMembers[0];

    nextOwner.role = 'owner';
    await nextOwner.save();
    await del(CACHE_KEYS.CONVERSATION_DETAILS(conversationId));
    await ConversationMember.deleteOne({ _id: member._id });
    await del(CACHE_KEYS.UNREAD_COUNT(currentUserId, conversationId));
    const io = getIO();
    io.in(`user:${currentUserId.toString()}`).socketsLeave(`conversation:${conversationId.toString()}`);
  } else {
    await ConversationMember.deleteOne({ _id: member._id });
    await del(CACHE_KEYS.UNREAD_COUNT(currentUserId, conversationId));
    const io = getIO();
    io.in(`user:${currentUserId.toString()}`).socketsLeave(`conversation:${conversationId.toString()}`);
  }

  return { success: true };
};

export const updateReceipt = async (userId, conversationId, messageId, type) => {
  const member = await ConversationMember.findOne({ conversationId, userId });
  if (!member) {
    throw new AppError('Forbidden', 403);
  }

  // We only want to update if it moves the cursor forward
  // MongoDB ObjectIds are timestamped, so we can do lexicographical comparison
  // string comparison works as long as the ObjectId is valid 24-char hex
  
  if (type === 'delivered') {
    if (!member.lastDeliveredMessageId || messageId.toString() > member.lastDeliveredMessageId.toString()) {
      member.lastDeliveredMessageId = messageId;
    }
  } else if (type === 'read') {
    if (!member.lastReadMessageId || messageId.toString() > member.lastReadMessageId.toString()) {
      member.lastReadMessageId = messageId;
    }
    // implicitly also means delivered
    if (!member.lastDeliveredMessageId || messageId.toString() > member.lastDeliveredMessageId.toString()) {
      member.lastDeliveredMessageId = messageId;
    }
  }

  await member.save();
  
  if (type === 'read') {
    await del(CACHE_KEYS.UNREAD_COUNT(userId, conversationId));
  }
};
