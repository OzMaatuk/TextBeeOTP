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
    if (!authHeader) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    try {
      const decoded = verifyAuthToken(token);
      return res.status(200).json({
        valid: true,
        email: decoded.email,
        sub: decoded.sub,
        exp: decoded.exp,
      });
    } catch (_err) {
      return res.status(401).json({ error: 'invalid_token' });
    }
  });

  return router;
}
