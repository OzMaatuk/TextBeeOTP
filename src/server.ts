import express, { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { createOtpRouter } from './routes/otp';
import { openApiSpec } from './openapi';
import { createLogger } from './utils/logger';
import { config } from './utils/config';
import { createOtpService } from './bootstrap';

export function createServer(): Express {
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
  const { otpService, repo } = createOtpService();
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.log = logger;
    next();
  });

  app.use('/otp', createOtpRouter({ otpService, repo }));

  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log.error({ err }, 'Unhandled request error');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
