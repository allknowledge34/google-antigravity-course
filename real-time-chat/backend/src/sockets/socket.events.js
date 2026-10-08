export const EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONVERSATION_ERROR: 'conversation:error',

  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_ERROR: 'message:error',
  
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  RECEIPT_UPDATED: 'receipt:updated',

  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',
  REACTION_UPDATED: 'reaction:updated',

  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_GET: 'presence:get',
  PRESENCE_SYNC: 'presence:sync',

  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
};
