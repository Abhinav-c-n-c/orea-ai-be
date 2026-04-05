import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { setupSocketServer } from './sockets/socketHandler';
import { seedSuperAdmin } from './utils/seedSuperAdmin';

const server = http.createServer(app);

// Setup Socket.io
setupSocketServer(server);

const PORT = parseInt(env.PORT, 10);

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Seed super admin on first boot
    await seedSuperAdmin();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});

startServer();
