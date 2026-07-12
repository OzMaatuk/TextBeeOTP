import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import crypto from 'crypto';
import swaggerUi from 'swagger-ui-express';
import { createOtpRouter } from './routes/otp.js';
import { createUiRouter } from './routes/ui.js';
import { createApiRouter } from './routes/api.js';
import { openApiSpec } from './openapi.js';
import { config } from './utils/config.js';
import { createOtpService } from './bootstrap.js';
import { createCorsMiddleware } from './middleware/corsPolicy.js';
import { createApiKeyAuth } from './middleware/apiKeyAuth.js';
import { IOtpRepository } from './repositories/otpRepository';

export interface ServerInstance {
  apiApp: Express;
  uiApp: Express;
  repo: IOtpRepository;
}

function nonceMiddleware(req: Request, res: Response, next: NextFunction) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

function helmetWithNonce() {
  return [
    nonceMiddleware,
    (req: Request, res: Response, next: NextFunction) =>
      helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", `'nonce-${res.locals.cspNonce}'`],
          },
        },
      })(req, res, next),
  ];
}

export function createServer(): ServerInstance {
  const { otpService, repo, providers, logger, securityConfig } = createOtpService();

  const apiApp = express();
  apiApp.set('trust proxy', securityConfig.trustProxy);

  apiApp.use(helmetWithNonce());
  apiApp.use(express.json({ limit: config.jsonBodyLimit }));
  apiApp.use(express.urlencoded({ extended: false, limit: config.jsonBodyLimit }));

  apiApp.use(
    createCorsMiddleware({ allowedOrigins: securityConfig.allowedOrigins, allowAll: securityConfig.allowAllOrigins })
  );

  // Unauthenticated lightweight endpoints — must be registered BEFORE auth middleware
  // so AppSail's startup health probe gets a fast 200 without needing an API key.
  apiApp.get('/', (_req, res) => res.status(200).send('ok'));
  apiApp.get('/health', (req: express.Request, res: express.Response) => {
    const submittedKey = req.headers['x-api-key'];
    const allKeys = [...securityConfig.apiKeys, ...(securityConfig.healthApiKey ? [securityConfig.healthApiKey] : [])];
    const hasValidKey = typeof submittedKey === 'string' && allKeys.some(k => {
      if (k.key.length !== submittedKey.length) return false;
      try {
        return crypto.timingSafeEqual(Buffer.from(k.key, 'utf8'), Buffer.from(submittedKey, 'utf8'));
      } catch {
        return false;
      }
    });

    if (!hasValidKey) {
      return res.json({ status: 'ok' });
    }

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

  // Mount UI router before auth middleware so browser users don't need an API key.
  // UI pages (/login, /verify) are at root. UI proxy OTP routes are at /ui/otp/*.
  const { pagesRouter, proxyRouter } = createUiRouter({ otpService, repo, providers });
  apiApp.use('/', pagesRouter);
  apiApp.use('/ui', proxyRouter);

  apiApp.use(
    createApiKeyAuth({
      keys: securityConfig.apiKeys,
      healthKeys: securityConfig.healthApiKey ? [securityConfig.healthApiKey] : [],
      logger,
    })
  );

  // OpenAPI documentation
  if (config.exposeDocs) {
    apiApp.use('/api-docs', swaggerUi.serve);
    apiApp.get('/api-docs', swaggerUi.setup(openApiSpec));
  }

  apiApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });

  // OTP endpoints - standalone authentication via /otp/send and /otp/verify
  apiApp.use('/otp', createOtpRouter({ otpService, repo, providers }));

  // API routes for third-party integration
  apiApp.use(
    '/api',
    createApiRouter({
      keys: securityConfig.apiKeys,
      healthKeys: securityConfig.healthApiKey ? [securityConfig.healthApiKey] : [],
      logger,
    })
  );

  // Create separate UI Application (used when UI_PORT != API_PORT)
  const uiApp = express();
  uiApp.set('trust proxy', 1);
  uiApp.use(helmetWithNonce());
  uiApp.use(express.json({ limit: config.jsonBodyLimit }));
  uiApp.use(express.urlencoded({ extended: false, limit: config.jsonBodyLimit }));
  uiApp.use(
    createCorsMiddleware({ allowedOrigins: securityConfig.allowedOrigins, allowAll: securityConfig.allowAllOrigins })
  );
  uiApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });
  uiApp.use('/', pagesRouter);
  uiApp.use('/ui', proxyRouter);

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
