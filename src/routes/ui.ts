import { Router, Request, Response } from 'express';
import path from 'path';

export function createUiRouter(): Router {
  const router = Router();

  router.get('/login', (_req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../views/login.html');
    res.sendFile(filePath);
  });

  router.get('/verify', (_req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../views/verify.html');
    res.sendFile(filePath);
  });

  return router;
}
