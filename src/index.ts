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
try {
  const privateKey = fs.readFileSync(path.resolve(__dirname, '../certs/server.key'), 'utf8');
  const certificate = fs.readFileSync(path.resolve(__dirname, '../certs/server.crt'), 'utf8');
  credentials = { key: privateKey, cert: certificate };
  logger.info('Loaded SSL certificates from certs/ directory');
} catch (e) {
  logger.info('No SSL certificates found in certs/ directory, falling back to HTTP');
}

const isSamePort = apiPort === uiPort;

if (isSamePort) {
  apiApp.use(uiApp);
}

if (credentials) {
  apiServer = https.createServer(credentials, apiApp).listen(apiPort, () => {
    logger.info({ port: apiPort }, isSamePort ? 'OTP API & UI service listening (HTTPS)' : 'OTP API service listening (HTTPS)');
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
    logger.info({ port: apiPort }, isSamePort ? 'OTP API & UI service listening (HTTP)' : 'OTP API service listening (HTTP)');
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
    if (repo && typeof repo === 'object' && 'destroy' in repo && typeof (repo as any).destroy === 'function') {
      (repo as any).destroy();
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
