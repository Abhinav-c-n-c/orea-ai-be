import mongoose, { Document, Schema } from 'mongoose';

export type TaskStatus = 'to_discuss' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface IComment {
  _id?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  mentions?: mongoose.Types.ObjectId[];
  createdAt: Date;
}

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  tags: string[];
  images: string[];
  dueDate?: Date;
  comments: IComment[];
  links: number;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const taskSchema = new Schema<ITask>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['to_discuss', 'todo', 'in_progress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [{ type: String, trim: true }],
    images: [{ type: String }],
    dueDate: { type: Date },
    comments: [commentSchema],
    links: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes
taskSchema.index({ boardId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ createdAt: -1 });

export default mongoose.model<ITask>('Task', taskSchema);
