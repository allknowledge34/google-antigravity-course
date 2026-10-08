import { EVENTS } from '../socket.events.js';
import { presenceManager } from '../presence.manager.js';
import { logger } from '../../config/logger.js';

export const registerPresenceHandlers = (io, socket) => {
  socket.on(EVENTS.PRESENCE_GET, async ({ userIds }, callback) => {
    try {
      if (!Array.isArray(userIds)) {
        return callback && callback({ error: 'userIds must be an array' });
      }

      // To be secure, we could verify the user shares a conversation with these userIds,
      // but for simplicity in this phase, we just return the online status for the requested userIds.
      // A more strictly secure implementation would verify membership overlap.
      
      const onlineUsers = presenceManager.getOnlineUsers(userIds);
      const queriedUsers = userIds;
      
      if (callback) {
        callback({ onlineUsers, queriedUsers });
      } else {
        socket.emit(EVENTS.PRESENCE_SYNC, { onlineUsers, queriedUsers });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to get presence');
      if (callback) callback({ error: 'Internal server error' });
    }
  });
};
