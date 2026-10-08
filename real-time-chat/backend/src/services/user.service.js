import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';

export const syncUser = async (clerkId, clerkProfile) => {
  let user = await User.findOne({ clerkId });

  if (!user) {
    let username = clerkProfile.username || clerkProfile.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'user_' + Math.random().toString(36).substring(2, 9);
    
    // Ensure uniqueness
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      username = `${username}_${Math.floor(Math.random() * 1000)}`;
    }

    user = await User.create({
      clerkId,
      username,
      displayName: clerkProfile.firstName ? `${clerkProfile.firstName} ${clerkProfile.lastName || ''}`.trim() : username,
      avatar: clerkProfile.imageUrl || '',
    });
  } else {
    // Sync logic if needed. For now, keep it simple and just update avatar if missing
    let updated = false;
    if (!user.avatar && clerkProfile.imageUrl) {
      user.avatar = clerkProfile.imageUrl;
      updated = true;
    }
    if (updated) {
      await user.save();
    }
  }

  return user;
};

export const updateProfile = async (clerkId, updateData) => {
  const user = await User.findOne({ clerkId });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (updateData.username && updateData.username !== user.username) {
    const existing = await User.findOne({ username: updateData.username });
    if (existing) {
      throw new AppError('USERNAME_ALREADY_EXISTS', 409);
    }
    user.username = updateData.username;
  }

  if (updateData.displayName !== undefined) {
    user.displayName = updateData.displayName;
  }
  if (updateData.bio !== undefined) {
    user.bio = updateData.bio;
  }
  if (updateData.avatar !== undefined) {
    user.avatar = updateData.avatar;
  }

  await user.save();
  return user;
};

export const searchUsers = async (query, currentClerkId, limit = 20) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const users = await User.find(
    {
      $and: [
        { clerkId: { $ne: currentClerkId } },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    },
    '_id username displayName avatar bio'
  ).limit(limit);

  return users;
};
