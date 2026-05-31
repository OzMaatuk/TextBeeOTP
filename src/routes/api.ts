import { Router, Request, Response } from 'express';
import { createApiKeyAuth } from '../middleware/apiKeyAuth.js';
import { config } from '../utils/config.js';
import { verifyAuthToken } from '../utils/jwt.js';

type ApiRouterDeps = {
  // Add any dependencies if needed
};

export function createApiRouter({}: ApiRouterDeps): Router {
  const router = Router();
  
  // Middleware for API key authentication
  router.use(createApiKeyAuth({
    keys: config.apiKeys ? config.apiKeys.split(',') : [],
    healthKeys: config.healthApiKey ? [config.healthApiKey] : [],
    logger: console
  }));

  // Token validation endpoint for third-party apps
  router.get('/api/auth/validate', (req: Request, res: Response) => {
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
        exp: decoded.exp
      });
    } catch (err) {
      return res.status(401).json({ error: 'invalid_token' });
    }
  });

  return router;
}