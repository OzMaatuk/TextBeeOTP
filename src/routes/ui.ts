import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createUiRouter(): Router {
  const router = Router();

  // Serve static JS files from views directory
  router.use('/views', express.static(path.join(__dirname, '../views')));

  router.get('/login', async (_req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../views/login.html');
    let html = await fs.readFile(filePath, 'utf-8');
    
    if (!config.enableOidc) {
      // Remove social login buttons when OIDC is disabled
      const socialSectionRegex = /(<div class="divider">OR<\/div>\s*<button type="button" class="method-btn method-social google" id="googleBtn">[\s\S]*?<\/button>\s*<button type="button" class="method-btn method-social facebook" id="facebookBtn">[\s\S]*?<\/button>)/;
      html = html.replace(socialSectionRegex, '');
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  router.get('/verify', (_req: Request, res: Response) => {
    const filePath = path.join(__dirname, '../views/verify.html');
    res.sendFile(filePath);
  });

  return router;
}
