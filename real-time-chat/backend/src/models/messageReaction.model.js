import mongoose from 'mongoose';

const messageReactionSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
    }
  },
  {
    timestamps: true,
  }
);

messageReactionSchema.index({ messageId: 1, userId: 1, emoji: 1 }, { unique: true });

export const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);
