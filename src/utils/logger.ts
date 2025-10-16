import pino from 'pino';

export function createLogger() {
  const logger = pino({
    transport: { target: 'pino-pretty' },
  });
  return logger;
}
