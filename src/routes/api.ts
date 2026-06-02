import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import { createApiKeyAuth } from '../middleware/apiKeyAuth.js';
import { verifyAuthToken } from '../utils/jwt.js';
import type { KeyStoreEntry } from '../utils/securityConfig.js';

type ApiRouterDeps = {
  keys: KeyStoreEntry[];
  healthKeys?: KeyStoreEntry[];
  logger: Logger;
};

export function createApiRouter({ keys, healthKeys = [], logger }: ApiRouterDeps): Router {
  const router = Router();

  router.use(createApiKeyAuth({ keys, healthKeys, logger }));

  // Token validation endpoint for third-party apps
  router.get('/auth/validate', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'missing_token' });
    }

    const match = authHeader.match(/^\s*Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const token = match[1].trim();
    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    try {
      const decoded = verifyAuthToken(token);
      logger.info({ token: token.slice(0, 20) + '...', email: decoded.email, exp: decoded.exp }, 'Token validated successfully');
      return res.status(200).json({
        valid: true,
        email: decoded.email,
        sub: decoded.sub,
        exp: decoded.exp,
      });
    } catch (err) {
      logger.warn({ token: token.slice(0, 20) + '...', error: String(err) }, 'Token validation failed');
      return res.status(401).json({ error: 'invalid_token' });
    }
  });

  return router;
}
