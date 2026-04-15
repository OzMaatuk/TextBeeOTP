import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

/**
 * Creates OIDC-related routes.
 *
 * Note: This OIDC provider is designed for external authentication providers (Google, Facebook, etc.)
 * via oauth2-proxy. It does NOT handle OTP verification.
 *
 * For OTP-based authentication, use the /otp endpoints directly.
 */
export function createOidcRoutes(): Router {
  const router = Router();

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'oidc',
      mode: 'external-authentication',
      message: 'OIDC provider is running. For OTP verification, use /otp endpoints directly.',
    });
  });

  logger.info('OIDC routes initialized - external authentication mode (no OTP)');

  return router;
}
