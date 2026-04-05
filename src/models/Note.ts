import mongoose, { Document, Schema } from 'mongoose';

export interface IEditHistory {
  content: string;
  editedBy: mongoose.Types.ObjectId;
  editedAt: Date;
}

export interface INote extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  author: mongoose.Types.ObjectId;
  editHistory: IEditHistory[];
  visibility: 'public' | 'private';
  mentions: mongoose.Types.ObjectId[];
  linkedTasks: mongoose.Types.ObjectId[];
  lastModifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const editHistorySchema = new Schema<IEditHistory>(
  {
    content: { type: String, required: true },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const noteSchema = new Schema<INote>(
  {
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    editHistory: [editHistorySchema],
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    linkedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Indexes
noteSchema.index({ tags: 1 });
noteSchema.index({ author: 1 });
noteSchema.index({ title: 'text', content: 'text' });
noteSchema.index({ createdAt: -1 });

export default mongoose.model<INote>('Note', noteSchema);
