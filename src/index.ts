import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Validate env and expose normalized config
import { config } from './utils/config';

import { createServer } from './server';
import { createLogger } from './utils/logger';

const port = config.port;
const logger = createLogger();

const { app, repo } = createServer();

const server = app.listen(port, () => {
  logger.info({ port }, 'OTP service listening');
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(() => {
    // Clean up repositories
    if (repo && typeof repo === 'object' && 'destroy' in repo && typeof (repo as any).destroy === 'function') {
      (repo as any).destroy();
    }
    logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after 30 seconds');
    process.exit(1);
  }, 30_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
