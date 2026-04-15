import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../utils/config.js';

// Use process.cwd() to find views directory relative to project root
// This avoids import.meta.url issues in some test environments
const projectRoot = process.cwd();
const getViewsDir = () => {
  // Check if we are running from dist or src
  const isDist = projectRoot.endsWith('dist') || projectRoot.includes('/dist');
  return path.join(projectRoot, isDist ? 'views' : 'src/views');
};
const _viewsDir = getViewsDir();

export function createUiRouter(): Router {
  const router = Router();

  // Serve static JS files from views directory
  router.use('/views', express.static(_viewsDir));

  router.get('/login', async (_req: Request, res: Response) => {
    const filePath = path.join(_viewsDir, 'login.html');
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
    const filePath = path.join(_viewsDir, 'verify.html');
    res.sendFile(filePath);
  });

  return router;
}
