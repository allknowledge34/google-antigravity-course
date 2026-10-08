import { logger } from '../config/logger.js';
import { ConversationMember } from '../models/conversationMember.model.js';
import { EVENTS } from './socket.events.js';

class PresenceManager {
  constructor() {
    // Map of userId (string) -> count of active sockets (number)
    this.userConnections = new Map();
  }

  async handleConnect(io, userId) {
    const uId = userId.toString();
    const currentCount = this.userConnections.get(uId) || 0;
    this.userConnections.set(uId, currentCount + 1);

    if (currentCount === 0) {
      // Transitioned to online
      await this.broadcastPresence(io, uId, true);
    }
  }

  async handleDisconnect(io, userId) {
    const uId = userId.toString();
    const currentCount = this.userConnections.get(uId) || 0;
    
    if (currentCount <= 1) {
      this.userConnections.delete(uId);
      // Transitioned to offline
      await this.broadcastPresence(io, uId, false);
    } else {
      this.userConnections.set(uId, currentCount - 1);
    }
  }

  async broadcastPresence(io, userId, isOnline) {
    try {
      // Find all conversations this user is a member of
      const memberships = await ConversationMember.find({ userId }).lean();
      
      const event = isOnline ? EVENTS.PRESENCE_ONLINE : EVENTS.PRESENCE_OFFLINE;
      
      const memberUserIds = new Set();
      
      memberships.forEach(member => {
        // Emit to active conversation room
        io.to(`conversation:${member.conversationId}`).emit(event, { userId });
      });

      // Find all unique users this user shares a conversation with
      const allSharedMembers = await ConversationMember.find({
        conversationId: { $in: memberships.map(m => m.conversationId) }
      }).lean();

      allSharedMembers.forEach(m => {
        if (m.userId.toString() !== userId.toString()) {
          memberUserIds.add(m.userId.toString());
        }
      });

      // Emit to each shared user's personal room
      memberUserIds.forEach(uId => {
        io.to(`user:${uId}`).emit(event, { userId });
      });
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to broadcast presence');
    }
  }

  isOnline(userId) {
    return this.userConnections.has(userId.toString());
  }

  getOnlineUsers(userIds) {
    const onlineUsers = [];
    userIds.forEach(id => {
      if (this.isOnline(id)) {
        onlineUsers.push(id.toString());
      }
    });
    return onlineUsers;
  }
}

export const presenceManager = new PresenceManager();
