export const CACHE_KEYS = {
  CONVERSATION_DETAILS: (conversationId) => `chat:conversation:${conversationId}`,
  USER_CONVERSATIONS: (userId) => `chat:user:${userId}:conversations`,
  UNREAD_COUNT: (userId, conversationId) => `chat:unread:${userId}:${conversationId}`,
};

export const CACHE_TTL = {
  SHORT: 300,   // 5 minutes
  MEDIUM: 3600, // 1 hour
  LONG: 86400,  // 1 day
};
