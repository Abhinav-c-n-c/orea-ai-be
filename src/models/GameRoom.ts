import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer {
  user: mongoose.Types.ObjectId;
  score?: number;
}

export interface IGameRoom extends Document {
  roomId: string;
  type: 'tictactoe' | 'bingo';
  players: IPlayer[];
  status: 'waiting' | 'in_progress' | 'completed';
  winner: mongoose.Types.ObjectId | null;
  currentTurn: mongoose.Types.ObjectId | null;
  state: Record<string, unknown>; // Flexible state (e.g., cell arrays, bingo grids)
  createdAt: Date;
  updatedAt: Date;
}

const gameRoomSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['tictactoe', 'bingo'], required: true },
    players: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        score: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: ['waiting', 'in_progress', 'completed'],
      default: 'waiting',
    },
    winner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    currentTurn: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    state: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const GameRoom = mongoose.model<IGameRoom>('GameRoom', gameRoomSchema);
