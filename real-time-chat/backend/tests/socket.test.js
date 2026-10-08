import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import Client from 'socket.io-client';
import { initSocketServer } from '../src/sockets/socket.server.js';
import { EVENTS } from '../src/sockets/socket.events.js';
import { presenceManager } from '../src/sockets/presence.manager.js';
import { User } from '../src/models/user.model.js';
import { Conversation } from '../src/models/conversation.model.js';
import { ConversationMember } from '../src/models/conversationMember.model.js';
import { Message } from '../src/models/message.model.js';

let io, clientSocket;
let activeSockets = [];
let httpServer;
let port;

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: vi.fn(async (token) => {
      if (token === 'valid_token_a') return { sub: 'clerk_sock_a' };
      if (token === 'valid_token_b') return { sub: 'clerk_sock_b' };
      if (token === 'valid_token_c') return { sub: 'clerk_sock_c' };
      return null;
    }),
  };
});

describe('Socket API', () => {
  let userA, userB, conversation;

  beforeAll(async () => {
    httpServer = createServer();
    io = initSocketServer(httpServer);
    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMember.deleteMany({});
    await Message.deleteMany({});

    userA = await User.create({ clerkId: 'clerk_sock_a', username: 'usera', displayName: 'User A' });
    userB = await User.create({ clerkId: 'clerk_sock_b', username: 'userb', displayName: 'User B' });
    await User.create({ clerkId: 'clerk_sock_c', username: 'userc', displayName: 'User C' });

    conversation = await Conversation.create({
      type: 'group',
      name: 'Test Group',
      createdBy: userA._id
    });

    await ConversationMember.create([
      { conversationId: conversation._id, userId: userA._id, role: 'owner' },
      { conversationId: conversation._id, userId: userB._id, role: 'member' }
    ]);
  });

  afterEach(() => {
    activeSockets.forEach(s => {
      if (s && s.connected) s.close();
    });
    activeSockets = [];
    clientSocket = null;
    presenceManager.userConnections.clear();
  });

  it('should reject unauthenticated connections', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, {
      auth: { token: 'invalid_token' },
    });

    await new Promise((resolve) => {
      clientSocket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        resolve();
      });
    });
  });

  it('should accept authenticated connections', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, {
      auth: { token: 'valid_token_a' },
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        resolve();
      });
    });
  });

  it('should prevent non-member from joining conversation', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, {
      auth: { token: 'valid_token_c' },
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        clientSocket.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
      });

      clientSocket.on(EVENTS.CONVERSATION_ERROR, (err) => {
        expect(err.message).toBe('Unauthorized to join this conversation');
        resolve();
      });
    });
  });

  it('should broadcast message:new after message:send', async () => {
    // Client A connects and joins
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, {
      auth: { token: 'valid_token_a' },
    });

    // Client B connects and joins
    const clientSocketB = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, {
      auth: { token: 'valid_token_b' },
    });

    await new Promise((resolve) => {
      let connections = 0;
      const ready = () => {
        connections++;
        if (connections === 2) {
          clientSocket.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          clientSocketB.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          
          // Give time for join to complete
          setTimeout(() => {
            clientSocket.emit(EVENTS.MESSAGE_SEND, {
              conversationId: conversation._id,
              clientMessageId: 'msg-socket-1',
              content: 'Hello via Socket'
            });
          }, 100);
        }
      };

      if (clientSocket.connected) ready(); else clientSocket.on('connect', ready);
      if (clientSocketB.connected) ready(); else clientSocketB.on('connect', ready);

      clientSocketB.on(EVENTS.MESSAGE_NEW, async (msg) => {
        expect(msg.content).toBe('Hello via Socket');
        expect(msg.clientMessageId).toBe('msg-socket-1');
        expect(msg.senderId._id).toBe(userA._id.toString()); // derived server-side
        
        const dbMsgCount = await Message.countDocuments();
        expect(dbMsgCount).toBe(1);
        
        clientSocketB.close();
        resolve();
      });
    });
  });
  it('should handle typing indicators correctly', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_a' } });
    const clientSocketB = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_b' } });

    await new Promise((resolve) => {
      let connections = 0;
      const ready = () => {
        connections++;
        if (connections === 2) {
          clientSocket.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          clientSocketB.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          
          setTimeout(() => {
            clientSocket.emit(EVENTS.TYPING_START, { conversationId: conversation._id });
          }, 100);
        }
      };

      clientSocket.on('connect', ready);
      clientSocketB.on('connect', ready);

      clientSocketB.on(EVENTS.TYPING_START, (msg) => {
        expect(msg.conversationId).toBe(conversation._id.toString());
        expect(msg.userId).toBe(userA._id.toString());
        
        clientSocket.emit(EVENTS.TYPING_STOP, { conversationId: conversation._id });
      });

      clientSocketB.on(EVENTS.TYPING_STOP, (msg) => {
        expect(msg.conversationId).toBe(conversation._id.toString());
        expect(msg.userId).toBe(userA._id.toString());
        
        clientSocketB.close();
        resolve();
      });
    });
  });

  it('should prevent non-members from typing', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_c' } });
    const clientSocketB = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_b' } });

    await new Promise((resolve, reject) => {
      let connections = 0;
      const ready = () => {
        connections++;
        if (connections === 2) {
          // B is a member, C is not. C tries to type.
          clientSocketB.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          
          setTimeout(() => {
            clientSocket.emit(EVENTS.TYPING_START, { conversationId: conversation._id });
            
            // If B doesn't receive it in 300ms, success
            setTimeout(() => {
              clientSocketB.close();
              resolve();
            }, 300);
          }, 100);
        }
      };

      clientSocket.on('connect', ready);
      clientSocketB.on('connect', ready);

      clientSocketB.on(EVENTS.TYPING_START, () => {
        reject(new Error('Should not receive typing event from non-member'));
      });
    });
  });

  it('should emit presence updates', async () => {
    clientSocket = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_b' } });

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        clientSocket.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
        
        setTimeout(() => {
          // Now A connects
          const clientSocketA = (function(url, opts) { const s = new Client(url, opts); activeSockets.push(s); return s; })(`http://localhost:${port}`, { auth: { token: 'valid_token_a' } });
          
          clientSocket.on(EVENTS.PRESENCE_ONLINE, (msg) => {
            if (msg.userId === userA._id.toString()) {
              clientSocketA.close();
            }
          });

          clientSocket.on(EVENTS.PRESENCE_OFFLINE, (msg) => {
            if (msg.userId === userA._id.toString()) {
              resolve();
            }
          });
        }, 100);
      });
    });
  });
});
