import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    directConversationKey: {
      type: String,
      unique: true,
      sparse: true, // Only exists for direct conversations
    }
  },
  {
    timestamps: true,
  }
);

// We rely on directConversationKey being sparse and unique.
// It will be constructed as `${min(userId1, userId2)}_${max(userId1, userId2)}`

export const Conversation = mongoose.model('Conversation', conversationSchema);
