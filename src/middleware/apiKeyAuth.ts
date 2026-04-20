import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import type { KeyStoreEntry } from '../utils/securityConfig.js';

export interface ApiKeyAuthOptions {
  keys: KeyStoreEntry[];
  healthKeys?: KeyStoreEntry[];
  logger: Logger;
}

const HEALTH_ROUTES = new Set(['/health', '/otp/health']);

/**
 * Compare two strings using a constant-time algorithm.
 * Pads both buffers to the same length to avoid length-based timing leaks.
 */
function safeCompare(a: string, b: string): boolean {
  // Use a fixed-length hash to normalize lengths and avoid leaking key length
  const maxLen = Math.max(Buffer.byteLength(a, 'utf8'), Buffer.byteLength(b, 'utf8'));
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a, 'utf8');
  bufB.write(b, 'utf8');
  return timingSafeEqual(bufA, bufB);
}

function findMatchingKey(submittedKey: string, keys: KeyStoreEntry[]): KeyStoreEntry | undefined {
  for (const entry of keys) {
    if (entry.enabled && safeCompare(submittedKey, entry.key)) {
      return entry;
    }
  }
  return undefined;
}

export function createApiKeyAuth(options: ApiKeyAuthOptions): RequestHandler {
  const { keys, healthKeys = [], logger } = options;

  return (req, res, next) => {
    const submittedKey = req.headers['x-api-key'];
    const path = req.path;
    const method = req.method;
    const ip = req.ip ?? 'unknown';

    if (!submittedKey || typeof submittedKey !== 'string') {
      logger.warn({ path, method, ip, reason: 'missing_key' }, 'auth_failure');
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Determine which key pool to check
    const isHealthRoute = HEALTH_ROUTES.has(path);
    const candidateKeys = isHealthRoute ? [...keys, ...healthKeys] : keys;

    const matched = findMatchingKey(submittedKey, candidateKeys);

    if (!matched) {
      logger.warn({ path, method, ip, reason: 'invalid_key' }, 'auth_failure');
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Attach key name for downstream use — never the key value
    (req as any).keyName = matched.name;
    logger.debug({ path, keyName: matched.name }, 'auth_success');
    next();
  };
}
