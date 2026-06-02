import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import fs from 'fs';
import https from 'https';

// Validate env and expose normalized config
import { config } from './utils/config.js';

import { createServer } from './server.js';
import { createLogger } from './utils/logger.js';

const apiPort = config.apiPort;
const uiPort = config.uiPort;
const logger = createLogger();

const { apiApp, uiApp, repo } = createServer();

let apiServer: import('http').Server | import('https').Server;
let uiServer: import('http').Server | import('https').Server;

let credentials = null;
// Skip SSL in production — Catalyst handles TLS termination externally
if (config.nodeEnv !== 'production') {
  try {
    const privateKey = fs.readFileSync(path.resolve(__dirname, '../certs/server.key'), 'utf8');
    const certificate = fs.readFileSync(path.resolve(__dirname, '../certs/server.crt'), 'utf8');
    credentials = { key: privateKey, cert: certificate };
    logger.info('Loaded SSL certificates from certs/ directory');
  } catch (_e) {
    logger.info('No SSL certificates found in certs/ directory, falling back to HTTP');
  }
}

const isSamePort = apiPort === uiPort;

if (isSamePort) {
  logger.warn(
    { apiPort, uiPort },
    'API_PORT and UI_PORT are the same. UI and API are served on a single port. ' +
      'Use separate ports in production for proper security isolation.'
  );
}

if (credentials) {
  apiServer = https.createServer(credentials, apiApp).listen(apiPort, () => {
    logger.info(
      { port: apiPort },
      isSamePort ? 'OTP API & UI service listening (HTTPS)' : 'OTP API service listening (HTTPS)'
    );
  });
  if (!isSamePort) {
    uiServer = https.createServer(credentials, uiApp).listen(uiPort, () => {
      logger.info({ port: uiPort }, 'OTP UI service listening (HTTPS)');
    });
  } else {
    uiServer = apiServer;
  }
} else {
  apiServer = apiApp.listen(apiPort, () => {
    logger.info(
      { port: apiPort },
      isSamePort ? 'OTP API & UI service listening (HTTP)' : 'OTP API service listening (HTTP)'
    );
  });
  if (!isSamePort) {
    uiServer = uiApp.listen(uiPort, () => {
      logger.info({ port: uiPort }, 'OTP UI service listening (HTTP)');
    });
  } else {
    uiServer = apiServer;
  }
}

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received');

  const closeRepoAndExit = () => {
    try {
      repo.destroy();
    } catch (err) {
      logger.warn({ err }, 'Error shutting down repository');
    }
    logger.info('Servers closed');
    process.exit(0);
  };

  if (isSamePort) {
    apiServer.close(() => closeRepoAndExit());
  } else {
    apiServer.close(() => {
      uiServer.close(() => closeRepoAndExit());
    });
  }

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after 30 seconds');
    process.exit(1);
  }, 30_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
