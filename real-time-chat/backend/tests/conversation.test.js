import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Conversation } from '../src/models/conversation.model.js';
import { ConversationMember } from '../src/models/conversationMember.model.js';

vi.mock('@clerk/express', () => {
  return {
    clerkMiddleware: () => (req, res, next) => {
      if (req.headers.authorization === 'Bearer valid_token_a') {
        req.auth = { userId: 'clerk_conv_conv_a' };
      } else if (req.headers.authorization === 'Bearer valid_token_b') {
        req.auth = { userId: 'clerk_conv_conv_b' };
      } else if (req.headers.authorization === 'Bearer valid_token_c') {
        req.auth = { userId: 'clerk_conv_c' };
      } else {
        req.auth = {};
      }
      next();
    },
    getAuth: (req) => req.auth || {},

  };
});

describe('Conversation API', () => {
  let userA, userB, userC;

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ConversationMember.deleteMany({});

    userA = await User.create({ clerkId: 'clerk_conv_conv_a', username: 'usera', displayName: 'User A' });
    userB = await User.create({ clerkId: 'clerk_conv_conv_b', username: 'userb', displayName: 'User B' });
    userC = await User.create({ clerkId: 'clerk_conv_c', username: 'userc', displayName: 'User C' });
  });

  describe('Direct Conversations', () => {
    it('should create a direct conversation', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'direct', memberId: userB._id.toString() });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('direct');
      expect(res.body.data.members).toHaveLength(2);
      
      const convCount = await Conversation.countDocuments();
      expect(convCount).toBe(1);
    });

    it('should reject self conversation', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'direct', memberId: userA._id.toString() });

      expect(res.status).toBe(400);
    });

    it('should prevent duplicate direct conversations (same order)', async () => {
      await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'direct', memberId: userB._id.toString() });

      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'direct', memberId: userB._id.toString() });

      expect(res.status).toBe(201); // we return 201 for existing as well per standard or 200, test accepts it
      const convCount = await Conversation.countDocuments();
      expect(convCount).toBe(1);
    });

    it('should prevent duplicate direct conversations (reverse order)', async () => {
      await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'direct', memberId: userB._id.toString() });

      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_b')
        .send({ type: 'direct', memberId: userA._id.toString() });

      expect(res.status).toBe(201);
      const convCount = await Conversation.countDocuments();
      expect(convCount).toBe(1);
    });
  });

  describe('Group Conversations', () => {
    it('should create a group conversation', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'group', name: 'My Group', memberIds: [userB._id.toString(), userC._id.toString()] });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Group');
      expect(res.body.data.members).toHaveLength(3);
      
      const owner = res.body.data.members.find(m => m._id === userA._id.toString());
      expect(owner.role).toBe('owner');
    });

    it('should reject invalid group name', async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'group', name: '', memberIds: [userB._id.toString()] });

      expect(res.status).toBe(400);
    });
  });

  describe('Fetching and Managing', () => {
    let groupConvId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_a')
        .send({ type: 'group', name: 'Test Group', memberIds: [userB._id.toString()] });
      groupConvId = res.body.data._id;
    });

    it('should fetch conversation list for a user', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', 'Bearer valid_token_b');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Test Group');
    });

    it('should deny non-members details access', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${groupConvId}`)
        .set('Authorization', 'Bearer valid_token_c');

      expect(res.status).toBe(403);
    });

    it('should allow owner to add a member', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${groupConvId}/members`)
        .set('Authorization', 'Bearer valid_token_a')
        .send({ memberId: userC._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.data.members).toHaveLength(3);
    });

    it('should not allow member to add a member', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${groupConvId}/members`)
        .set('Authorization', 'Bearer valid_token_b')
        .send({ memberId: userC._id.toString() });

      expect(res.status).toBe(403);
    });

    it('should allow user to leave the group', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${groupConvId}/leave`)
        .set('Authorization', 'Bearer valid_token_b');

      expect(res.status).toBe(200);
      
      const fetchRes = await request(app)
        .get(`/api/v1/conversations/${groupConvId}`)
        .set('Authorization', 'Bearer valid_token_b');
      expect(fetchRes.status).toBe(403);
    });
  });
});
