import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Conversation } from '../src/models/conversation.model.js';
import { ConversationMember } from '../src/models/conversationMember.model.js';
import { Message } from '../src/models/message.model.js';

vi.mock('@clerk/express', () => {
  return {
    clerkMiddleware: () => (req, res, next) => {
      if (req.headers.authorization === 'Bearer valid_token_a') {
        req.auth = { userId: 'clerk_msg_a' };
      } else if (req.headers.authorization === 'Bearer valid_token_b') {
        req.auth = { userId: 'clerk_msg_b' };
      } else if (req.headers.authorization === 'Bearer valid_token_c') {
        req.auth = { userId: 'clerk_msg_c' };
      } else {
        req.auth = {};
      }
      next();
    },
    getAuth: (req) => req.auth || {},

  };
});

describe('Message API', () => {
  let userA, userB, conversation;

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMember.deleteMany({});
    await Message.deleteMany({});

    userA = await User.create({ clerkId: 'clerk_msg_a', username: 'usera', displayName: 'User A' });
    userB = await User.create({ clerkId: 'clerk_msg_b', username: 'userb', displayName: 'User B' });
    await User.create({ clerkId: 'clerk_msg_c', username: 'userc', displayName: 'User C' });

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

  describe('Create Message', () => {
    it('should allow member to create a message', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${conversation._id}/messages`)
        .set('Authorization', 'Bearer valid_token_a')
        .send({
          clientMessageId: 'msg-1',
          content: 'Hello world'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.content).toBe('Hello world');
      expect(res.body.data.senderId._id).toBe(userA._id.toString());
      
      const conv = await Conversation.findById(conversation._id);
      expect(conv.lastMessage.content).toBe('Hello world');
      expect(conv.lastMessageAt).toBeTruthy();
    });

    it('should reject non-member from creating a message', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${conversation._id}/messages`)
        .set('Authorization', 'Bearer valid_token_c')
        .send({
          clientMessageId: 'msg-2',
          content: 'Hacking in'
        });

      expect(res.status).toBe(403);
    });

    it('should prevent duplicate clientMessageId', async () => {
      await request(app)
        .post(`/api/v1/conversations/${conversation._id}/messages`)
        .set('Authorization', 'Bearer valid_token_a')
        .send({ clientMessageId: 'duplicate-1', content: 'First try' });

      const res = await request(app)
        .post(`/api/v1/conversations/${conversation._id}/messages`)
        .set('Authorization', 'Bearer valid_token_a')
        .send({ clientMessageId: 'duplicate-1', content: 'Second try' });

      expect(res.status).toBe(201); // Retruns 201 with existing data
      expect(res.body.data.content).toBe('First try');
      
      const msgCount = await Message.countDocuments();
      expect(msgCount).toBe(1);
    });
  });

  describe('Get Messages & Pagination', () => {
    beforeEach(async () => {
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          conversationId: conversation._id,
          senderId: userA._id,
          clientMessageId: `bulk-${i}`,
          content: `Msg ${i}`
        });
      }
      await Message.insertMany(messages);
    });

    it('should return recent messages deterministically', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${conversation._id}/messages?limit=10`)
        .set('Authorization', 'Bearer valid_token_a');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(10);
      expect(res.body.meta.hasMore).toBe(true);
      expect(res.body.meta.nextCursor).toBeTruthy();
      
      // Should be in chronological order
      // We inserted 0 to 19 sequentially. But depending on how fast insertMany works, 
      // they might have same timestamp. Since we sort by _id descending, 19 is the newest.
      // We requested limit=10, so it gets 19 down to 10, then reverses to 10..19
      expect(res.body.data[9].content).toBe('Msg 19');
    });
  });

  describe('Edit & Delete', () => {
    let msgId;
    beforeEach(async () => {
      const msg = await Message.create({
        conversationId: conversation._id,
        senderId: userA._id,
        clientMessageId: 'edit-1',
        content: 'Original content'
      });
      msgId = msg._id;
    });

    it('should allow sender to edit', async () => {
      const res = await request(app)
        .patch(`/api/v1/messages/${msgId}`)
        .set('Authorization', 'Bearer valid_token_a')
        .send({ content: 'Edited content' });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Edited content');
      expect(res.body.data.editedAt).toBeTruthy();
    });

    it('should reject others from editing', async () => {
      const res = await request(app)
        .patch(`/api/v1/messages/${msgId}`)
        .set('Authorization', 'Bearer valid_token_b')
        .send({ content: 'Hacked content' });

      expect(res.status).toBe(403);
    });

    it('should allow sender to delete (soft delete)', async () => {
      const res = await request(app)
        .delete(`/api/v1/messages/${msgId}`)
        .set('Authorization', 'Bearer valid_token_a');

      expect(res.status).toBe(200);
      
      const inDb = await Message.findById(msgId);
      expect(inDb.deletedAt).toBeTruthy();
      expect(inDb.content).toBe('Original content'); // original remains in DB

      // Fetching should mask it
      const fetchRes = await request(app)
        .get(`/api/v1/conversations/${conversation._id}/messages`)
        .set('Authorization', 'Bearer valid_token_a');

      expect(fetchRes.body.data[0].content).toBe('');
      expect(fetchRes.body.data[0].deletedAt).toBeTruthy();
    });
  });
});
