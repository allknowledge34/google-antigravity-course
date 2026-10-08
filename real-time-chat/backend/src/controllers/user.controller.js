import { clerkClient, getAuth } from '@clerk/express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as userService from '../services/user.service.js';

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  
  // We need to fetch the clerk user to get initial profile data (like email/name)
  // in case the user doesn't exist in our DB yet.
  const clerkUser = await clerkClient.users.getUser(userId);
  
  const user = await userService.syncUser(userId, clerkUser);

  res.status(200).json({
    success: true,
    data: user
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const updateData = req.body;

  const user = await userService.updateProfile(userId, updateData);

  res.status(200).json({
    success: true,
    data: user
  });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const query = req.query.q || '';

  const users = await userService.searchUsers(query, userId);

  res.status(200).json({
    success: true,
    data: users
  });
});
