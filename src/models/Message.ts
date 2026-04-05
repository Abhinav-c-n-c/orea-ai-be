import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  conversationId: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  mediaUrl?: string;
  encrypted: boolean;
  delivered: boolean;
  read: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversationId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video'],
      default: 'text',
    },
    mediaUrl: { type: String },
    encrypted: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for efficient conversation lookups
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, read: 1 });

// Static method to generate conversation ID
messageSchema.statics.getConversationId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

export const getConversationId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('_');
};

export default mongoose.model<IMessage>('Message', messageSchema);
