import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express, { Router, Request, Response } from 'express';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createUiRouter(): Router {
  const router = Router();

  // Serve static JS files from views directory
  router.use('/views', express.static(path.join(__dirname, '../views')));

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
