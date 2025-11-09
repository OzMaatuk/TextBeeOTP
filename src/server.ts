import express, { Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { otpRouter } from './routes/otp';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';
import { createLogger } from './utils/logger';
import { config } from './utils/config';

export function createServer(): Express {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  // OpenAPI documentation
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(openApiSpec));

  const logger = createLogger();
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // attach logger to req for controllers
    (req as any).log = logger;
    next();
  });

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);

  app.use('/otp', otpRouter);

  app.get('/health', (_req: express.Request, res: express.Response) => {
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: config.redisUrl ? 'configured' : 'not_configured',
    };
    res.json(health);
  });

  app.get('/health/redis', (_req: express.Request, res: express.Response) => {
    // This endpoint will be enhanced by the route that has access to the repo
    res.json({
      redisUrl: config.redisUrl ? config.redisUrl.replace(/:[^:@]+@/, ':****@') : null,
      configured: !!config.redisUrl,
    });
  });

  return app;
}
