import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Presence ──────────────────────────────────────────────────────────────────

export const addOnlineUser = async (userId: string): Promise<void> => {
  await Promise.all([
    redis.sadd('app:online:users', userId),
    redis.set(`app:user:${userId}`, { online: true, ts: Date.now() }, { ex: 86400 }),
  ]);
};

export const removeOnlineUser = async (userId: string): Promise<void> => {
  await Promise.all([
    redis.srem('app:online:users', userId),
    redis.del(`app:user:${userId}`),
  ]);
};

export const getOnlineUserIds = async (): Promise<string[]> => {
  return (await redis.smembers('app:online:users')) as string[];
};

// ── Room State ────────────────────────────────────────────────────────────────

export const addUserToRoom = async (roomId: string, userId: string): Promise<void> => {
  await redis.sadd(`app:room:${roomId}:users`, userId);
  await redis.expire(`app:room:${roomId}:users`, 3600);
};

export const removeUserFromRoom = async (roomId: string, userId: string): Promise<void> => {
  await redis.srem(`app:room:${roomId}:users`, userId);
};

export const getRoomUsers = async (roomId: string): Promise<string[]> => {
  return (await redis.smembers(`app:room:${roomId}:users`)) as string[];
};

export const setRoomState = async (roomId: string, state: Record<string, unknown>): Promise<void> => {
  await redis.set(`app:room:${roomId}:state`, JSON.stringify(state), { ex: 3600 });
};

export const getRoomState = async (roomId: string): Promise<Record<string, unknown> | null> => {
  const raw = await redis.get(`app:room:${roomId}:state`);
  if (!raw) return null;
  try {
    return JSON.parse(raw as string);
  } catch {
    return null;
  }
};

export default redis;
