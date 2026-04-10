import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { setupWsServer } from './sockets/wsHandler';
import { seedSuperAdmin } from './utils/seedSuperAdmin';

const server = http.createServer(app);

// Setup raw WebSocket server (replaces Socket.IO)
setupWsServer(server);

// const PORT = parseInt(env.PORT, 10);
const PORT = parseInt(process.env.PORT || env.PORT, 10);
const startServer = async () => {
  try {
    await connectDB();
    await seedSuperAdmin();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`🔌 WS:  ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});

startServer();
