import { io } from 'socket.io-client';
import { EVENTS } from './events.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.getToken = null;
    this.activeConversationId = null;
    
    // Callbacks to update UI connection state if needed
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.listeners = new Map();
  }

  init(getTokenFn) {
    this.getToken = getTokenFn;
  }

  async connect(onConnect, onDisconnect, onError) {
    if (!this.getToken) {
      console.warn('SocketService initialized without getToken function');
      return;
    }

    if (this.socket?.connected) return;

    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.onError = onError;

    const token = await this.getToken();
    if (!token) return; // Cannot connect without token

    const backendUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

    this.socket = io(backendUrl, {
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket.on(event, callback);
      });
    });

    this.socket.on(EVENTS.CONNECT, () => {
      this.onConnect?.();
      // On reconnect, rejoin the active room if we have one
      if (this.activeConversationId) {
        this.joinConversation(this.activeConversationId);
      }
    });

    this.socket.on(EVENTS.DISCONNECT, (reason) => {
      this.onDisconnect?.(reason);
    });

    this.socket.on(EVENTS.CONNECT_ERROR, async (err) => {
      this.onError?.(err.message);
      // If it's an auth error, maybe token expired. Let's try getting a new one.
      if (err.message.includes('Authentication error') || err.message.includes('Invalid token')) {
        try {
          const newToken = await this.getToken();
          if (newToken && this.socket) {
            this.socket.auth.token = newToken;
          }
        } catch (e) {
          // unable to get token
        }
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId) {
    if (this.activeConversationId && this.activeConversationId !== conversationId) {
      this.leaveConversation(this.activeConversationId);
    }
    this.activeConversationId = conversationId;
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.CONVERSATION_JOIN, { conversationId });
    }
  }

  leaveConversation(conversationId) {
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.CONVERSATION_LEAVE, { conversationId });
    }
  }

  sendMessage(payload) {
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.MESSAGE_SEND, payload);
      return true;
    }
    return false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
