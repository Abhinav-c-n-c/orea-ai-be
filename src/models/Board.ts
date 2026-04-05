import mongoose, { Document, Schema } from 'mongoose';

export interface IBoard extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const boardSchema = new Schema<IBoard>(
  {
    name: {
      type: String,
      required: [true, 'Board name is required'],
      trim: true,
      maxlength: [100, 'Board name must be at most 100 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
boardSchema.index({ createdBy: 1 });
boardSchema.index({ createdAt: -1 });

export default mongoose.model<IBoard>('Board', boardSchema);
