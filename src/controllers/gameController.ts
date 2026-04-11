import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { GameRoom } from '../models/GameRoom';
import { AuthRequest } from '../middlewares/authMiddleware';

export const createRoom = async (req: Request, res: Response) => {
  const generateBingoGrid = () => {
    const nums = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
  };
  try {
    const { type } = req.body;
    if (!['tictactoe', 'bingo'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid game type' });
    }

    const roomId = randomUUID().substring(0, 8).toUpperCase(); // Short room ID in UPPERCASE
    const hostId = (req as AuthRequest).userId;
    const newRoom = new GameRoom({
      roomId,
      type,
      players: [{ user: hostId }],
      state: type === 'tictactoe' ? { board: Array(9).fill(null) } : { calledNumbers: [], grids: { [(hostId as string).toString()]: generateBingoGrid() } },
    });

    await newRoom.save();

    res.status(201).json({
      success: true,
      data: newRoom,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Failed to create game room' });
  }
};

export const getRoom = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = await GameRoom.findOne({ roomId }).populate('players.user', 'name email avatar').populate('winner', 'name').populate('currentTurn', 'name');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Failed to fetch game room' });
  }
};

export const joinRoom = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = await GameRoom.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: 'Game already in progress or completed' });
    }

    // Check if player is already in room
    const isAlreadyPlayer = room.players.some((p) => p.user.toString() === (req as AuthRequest).userId);
    
    if (!isAlreadyPlayer) {
      if (room.players.length >= 2) {
        return res.status(400).json({ success: false, message: 'Room is full' });
      }
      const newPlayerId = (req as AuthRequest).userId as any;
      room.players.push({ user: newPlayerId });

      if (room.type === 'bingo') {
        const generateBingoGrid = () => {
          const nums = Array.from({ length: 25 }, (_, i) => i + 1);
          for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
          }
          return nums;
        };
        const currentGrids = (room.state as any)?.grids || {};
        room.state = {
          ...((room.state as any) || {}),
          grids: {
            ...currentGrids,
            [newPlayerId.toString()]: generateBingoGrid()
          }
        };
        room.markModified('state');
      }

      if (room.players.length === 2) {
        room.status = 'in_progress';
        // Player 1 goes first randomly
        room.currentTurn = room.players[Math.floor(Math.random() * 2)].user;
      }
      await room.save();
    }

    const populatedRoom = await GameRoom.findById(room._id).populate('players.user', 'name email avatar').populate('winner', 'name').populate('currentTurn', 'name');

    res.status(200).json({
      success: true,
      data: populatedRoom,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Failed to join game room' });
  }
};

export const getUserGames = async (req: Request, res: Response) => {
  try {
    const games = await GameRoom.find({ 'players.user': (req as AuthRequest).userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('players.user', 'name email avatar')
      .populate('winner', 'name');

    res.status(200).json({
      success: true,
      data: games,
    });
  } catch (_error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user games' });
  }
};
