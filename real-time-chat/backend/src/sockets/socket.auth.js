import { verifyToken } from '@clerk/backend';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const verifiedSession = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    
    if (!verifiedSession || !verifiedSession.sub) {
      return next(new Error('Authentication error: Invalid token'));
    }

    const clerkId = verifiedSession.sub;
    const user = await User.findOne({ clerkId }).lean();

    if (!user) {
      return next(new Error('Authentication error: User not found in local database'));
    }

    // Attach authenticated user to socket
    socket.user = user;
    next();
  } catch (error) {
    next(new Error(`Authentication error: ${error.message}`));
  }
};
