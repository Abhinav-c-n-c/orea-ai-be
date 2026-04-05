import mongoose from 'mongoose';
import { env } from './env';

// Cache the connection across serverless function invocations (critical for Vercel)
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.mongooseCache) {
  global.mongooseCache = { conn: null, promise: null };
}

export const connectDB = async (): Promise<void> => {
  // If already connected, reuse the existing connection
  if (global.mongooseCache.conn) {
    return;
  }

  // If a connection is in progress, wait for it
  if (!global.mongooseCache.promise) {
    global.mongooseCache.promise = mongoose.connect(env.MONGO_URI, {
      dbName: 'collab_system',
      bufferCommands: false,           // Fail fast instead of buffering
      serverSelectionTimeoutMS: 30000, // 30s to find a server
      socketTimeoutMS: 45000,          // 45s socket timeout
      connectTimeoutMS: 30000,         // 30s to establish connection
      maxPoolSize: 10,                 // Reuse up to 10 connections
      minPoolSize: 1,
    });
  }

  try {
    global.mongooseCache.conn = await global.mongooseCache.promise;
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    // Reset on failure so next call tries again
    global.mongooseCache.promise = null;
    console.error('❌ MongoDB Connection Error:', error);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB Disconnected — resetting cache');
  global.mongooseCache = { conn: null, promise: null };
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err);
  global.mongooseCache = { conn: null, promise: null };
});
