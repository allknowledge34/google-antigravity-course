import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { initSocketServer } from '../src/sockets/socket.server.js';
import { User } from '../src/models/user.model.js';
import { Conversation } from '../src/models/conversation.model.js';
import { ConversationMember } from '../src/models/conversationMember.model.js';
import { Message } from '../src/models/message.model.js';
import { EVENTS } from '../src/sockets/socket.events.js';
import { presenceManager } from '../src/sockets/presence.manager.js';

let httpServer1, httpServer2;
let port1, port2;
let io1, io2;
let activeSockets = [];

vi.mock('@clerk/backend', () => {
  return {
    verifyToken: vi.fn(async (token) => {
      if (token === 'valid_token_a') return { sub: 'clerk_sc_a' };
      if (token === 'valid_token_b') return { sub: 'clerk_sc_b' };
      return null;
    }),
  };
});

describe('Socket API - Redis Cluster', () => {
  let userA, userB, conversation;

  beforeAll(async () => {
    httpServer1 = createServer();
    io1 = initSocketServer(httpServer1);
    await new Promise((resolve) => {
      httpServer1.listen(() => {
        port1 = httpServer1.address().port;
        resolve();
      });
    });

    httpServer2 = createServer();
    io2 = initSocketServer(httpServer2);
    await new Promise((resolve) => {
      httpServer2.listen(() => {
        port2 = httpServer2.address().port;
        resolve();
      });
    });
  });

  afterAll(() => {
    io1.close();
    io2.close();
    httpServer1.close();
    httpServer2.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMember.deleteMany({});
    await Message.deleteMany({});

    userA = await User.create({ clerkId: 'clerk_sc_a', username: 'usera', displayName: 'User A' });
    userB = await User.create({ clerkId: 'clerk_sc_b', username: 'userb', displayName: 'User B' });

    conversation = await Conversation.create({ type: 'group', createdBy: userA._id });
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
    presenceManager.userConnections.clear();
  });

  function createClient(url, opts) {
    const socket = new Client(url, opts);
    activeSockets.push(socket);
    return socket;
  }

  it('should propagate messages across two separate Node instances via Redis Adapter', async () => {
    const clientA = createClient(`http://localhost:${port1}`, { auth: { token: 'valid_token_a' } });
    const clientB = createClient(`http://localhost:${port2}`, { auth: { token: 'valid_token_b' } });

    await new Promise((resolve, reject) => {
      let connections = 0;
      const ready = () => {
        connections++;
        if (connections === 2) {
          clientA.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          clientB.emit(EVENTS.CONVERSATION_JOIN, { conversationId: conversation._id });
          
          setTimeout(() => {
            clientA.emit(EVENTS.MESSAGE_SEND, {
              conversationId: conversation._id,
              clientMessageId: 'cross-server-1',
              content: 'Hello across Redis Cluster'
            });
          }, 200);
        }
      };

      if (clientA.connected) ready(); else clientA.on('connect', ready);
      if (clientB.connected) ready(); else clientB.on('connect', ready);
      
      clientB.on(EVENTS.MESSAGE_NEW, (msg) => {
        try {
          expect(msg.content).toBe('Hello across Redis Cluster');
          expect(msg.clientMessageId).toBe('cross-server-1');
          resolve();
        } catch(err) {
          reject(err);
        }
      });
    });
  });
});
