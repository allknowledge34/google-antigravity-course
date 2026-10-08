import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/user.model.js';

// Mock Clerk middleware
vi.mock('@clerk/express', () => {
  return {
    clerkMiddleware: () => (req, res, next) => {
      // Mock auth object injection
      if (req.headers.authorization === 'Bearer valid_token') {
        req.auth = { userId: 'clerk_123' };
      } else {
        req.auth = {};
      }
      next();
    },
    getAuth: (req) => req.auth || {},

    clerkClient: {
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: 'clerk_123',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          imageUrl: 'http://example.com/avatar.jpg'
        })
      }
    }
  };
});

describe('User API endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('GET /api/v1/users/me', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/v1/users/me');
      expect(response.status).toBe(401);
    });

    it('should create local user and return profile on first request', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer valid_token');
        
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.clerkId).toBe('clerk_123');
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.displayName).toBe('Test User');
    });

    it('should not create duplicate local user on subsequent requests', async () => {
      await User.create({
        clerkId: 'clerk_123',
        username: 'existinguser',
        displayName: 'Existing User'
      });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer valid_token');

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('existinguser');
      
      const userCount = await User.countDocuments();
      expect(userCount).toBe(1);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    beforeEach(async () => {
      await User.create({
        clerkId: 'clerk_123',
        username: 'testuser',
        displayName: 'Test User'
      });
    });

    it('should update user profile correctly', async () => {
      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer valid_token')
        .send({
          displayName: 'Updated Name',
          bio: 'New bio'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.displayName).toBe('Updated Name');
      expect(response.body.data.bio).toBe('New bio');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer valid_token')
        .send({
          username: 'a' // too short
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate username', async () => {
      await User.create({
        clerkId: 'clerk_456',
        username: 'takenname',
        displayName: 'Taken Name'
      });

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer valid_token')
        .send({
          username: 'takenname'
        });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/v1/users/search', () => {
    beforeEach(async () => {
      await User.create([
        { clerkId: 'clerk_123', username: 'testuser', displayName: 'Test User' },
        { clerkId: 'clerk_456', username: 'alice', displayName: 'Alice Smith' },
        { clerkId: 'clerk_789', username: 'bob', displayName: 'Bob Jones' },
      ]);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/users/search?q=alice');
      expect(response.status).toBe(401);
    });

    it('should find users by username', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=alice')
        .set('Authorization', 'Bearer valid_token');
        
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].username).toBe('alice');
      // Should not expose clerkId
      expect(response.body.data[0].clerkId).toBeUndefined();
    });

    it('should exclude the current user from results', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?q=test')
        .set('Authorization', 'Bearer valid_token');
        
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });
});
