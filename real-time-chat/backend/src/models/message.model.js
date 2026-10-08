import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientMessageId: {
      type: String,
      required: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: function() { return !this.attachment; },
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'file'],
      default: 'text',
      required: true,
    },
    
    attachment: {
      url: String,
      publicId: String,
      format: String,
      size: Number
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotent creation to prevent duplicate messages from the same client
messageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true }
);

// Cursor pagination index (conversation + _id for deterministic chronological order)
messageSchema.index({ conversationId: 1, _id: -1 });

export const Message = mongoose.model('Message', messageSchema);
