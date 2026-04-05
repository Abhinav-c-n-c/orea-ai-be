import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'status_changed',
        'assigned',
        'unassigned',
        'commented',
        'deleted',
        'priority_changed',
      ],
    },
    details: {
      type: String,
      required: true,
    },
    previousValue: { type: String },
    newValue: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ taskId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1 });

export default mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
