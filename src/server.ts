import express, { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createOtpRouter } from './routes/otp.js';
import { createUiRouter } from './routes/ui.js';
import { openApiSpec } from './openapi.js';
import { createLogger } from './utils/logger.js';
import { config } from './utils/config.js';
import { createOtpService } from './bootstrap.js';
import { IOtpRepository } from './repositories/otpRepository';

export interface ServerInstance {
  apiApp: Express;
  uiApp: Express;
  repo: IOtpRepository;
}

export function createServer(): ServerInstance {
  const apiApp = express();
  apiApp.set('trust proxy', 1);

  apiApp.use(helmet());
  apiApp.use(express.json({ limit: config.jsonBodyLimit }));
  apiApp.use(express.urlencoded({ extended: false, limit: config.jsonBodyLimit }));

  // Add basic CORS rules to allow the separate UI app to make cross-origin API calls locally
  apiApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Note: In production you should restrict this to your actual UI domain
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // OpenAPI documentation
  if (config.exposeDocs) {
    apiApp.use('/api-docs', swaggerUi.serve);
    apiApp.get('/api-docs', swaggerUi.setup(openApiSpec));
  }

  const logger = createLogger();
  const { otpService, repo, providers } = createOtpService();
  apiApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });

  // OTP endpoints - standalone authentication via /otp/send and /otp/verify
  apiApp.use('/otp', createOtpRouter({ otpService, repo, providers }));

  // Create separate UI Application
  const uiApp = express();
  uiApp.set('trust proxy', 1);
  uiApp.use(helmet());
  uiApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });
  // UI routes for OTP login and verification
  uiApp.use('/', createUiRouter());

  // Setup OIDC provider (only if enabled and not in test mode)
  // OIDC is for external authentication (Google, Facebook, etc.) via oauth2-proxy
  if (config.enableOidc && process.env.NODE_ENV !== 'test') {
    (async () => {
      try {
        const { createOidcProvider } = await import('./oidc/provider.js');
        const { createOidcRoutes } = await import('./oidc/routes.js');
        await createOidcProvider(apiApp);
        apiApp.use('/oauth2', createOidcRoutes());
        logger.info(
          { clientId: config.oidcClientId, issuer: config.oidcServerUrl },
          'OIDC provider enabled for external authentication'
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to initialize OIDC provider');
      }
    })();
  }

  apiApp.get('/health', (_req: express.Request, res: express.Response) => {
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

  apiApp.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log.error({ err }, 'Unhandled request error');
    res.status(500).json({ error: 'internal_error' });
  });

  uiApp.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log.error({ err }, 'Unhandled request error');
    res.status(500).json({ error: 'internal_error' });
  });

  return { apiApp, uiApp, repo };
}
