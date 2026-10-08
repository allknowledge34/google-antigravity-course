import mongoose from 'mongoose';

const conversationMemberSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lastDeliveredMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate membership
conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
// Fast query for user's conversations
conversationMemberSchema.index({ userId: 1, conversationId: 1 });
// Queries by role within a conversation
conversationMemberSchema.index({ conversationId: 1, role: 1 });

export const ConversationMember = mongoose.model('ConversationMember', conversationMemberSchema);
