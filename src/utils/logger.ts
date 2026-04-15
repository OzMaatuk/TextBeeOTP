import pino from 'pino';
import { config } from './config.js';

export function createLogger() {
  const logger = pino({
    ...(config.nodeEnv === 'development' && {
      transport: { target: 'pino-pretty' },
    }),
  });
  return logger;
}
