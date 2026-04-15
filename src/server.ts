import express, { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createOtpRouter } from './routes/otp';
import { createUiRouter } from './routes/ui';
import { openApiSpec } from './openapi';
import { createLogger } from './utils/logger';
import { config } from './utils/config';
import { createOtpService } from './bootstrap';
import { IOtpRepository } from './repositories/otpRepository';

export interface ServerInstance {
  app: Express;
  repo: IOtpRepository;
}

export function createServer(): ServerInstance {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.jsonBodyLimit }));

  // OpenAPI documentation
  if (config.exposeDocs) {
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(openApiSpec));
  }

  const logger = createLogger();
  const { otpService, repo, providers } = createOtpService();
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });

  // OTP endpoints - standalone authentication via /otp/send and /otp/verify
  app.use('/otp', createOtpRouter({ otpService, repo, providers }));

  // UI routes for OTP login and verification
  app.use('/', createUiRouter());

  // Setup OIDC provider (only if enabled and not in test mode)
  // OIDC is for external authentication (Google, Facebook, etc.) via oauth2-proxy
  if (config.enableOidc && process.env.NODE_ENV !== 'test') {
    try {
      const { createOidcProvider } = require('./oidc/provider');
      const { createOidcRoutes } = require('./oidc/routes');
      createOidcProvider(app);
      app.use('/oauth2', createOidcRoutes());
      logger.info(
        { clientId: config.oidcClientId, issuer: config.oidcServerUrl },
        'OIDC provider enabled for external authentication'
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize OIDC provider');
    }
  }

  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      oidcEnabled: config.enableOidc,
      authMethods: {
        otp: 'Available at /otp/send and /otp/verify',
        oidc: config.enableOidc ? 'Available at /.well-known/openid-configuration' : 'Disabled',
      },
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log.error({ err }, 'Unhandled request error');
    res.status(500).json({ error: 'internal_error' });
  });

  return { app, repo };
}
