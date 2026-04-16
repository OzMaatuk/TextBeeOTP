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

  // Redirect root to login page
  router.get('/', (_req: Request, res: Response) => {
    res.redirect('/login');
  });

  // Serve static JS files from views directory
  router.use('/views', express.static(_viewsDir));

  let cachedLoginHtml: string | null = null;

  router.get('/login', async (_req: Request, res: Response) => {
    if (!cachedLoginHtml) {
      const filePath = path.join(_viewsDir, 'login.html');
      cachedLoginHtml = await fs.readFile(filePath, 'utf-8');
    }
    
    let html = cachedLoginHtml;
    
    let injections = '';
    
    // Pass the API endpoint to the frontend JS to handle the port separation correctly
    const protocol = _req.secure ? 'https' : 'http';
    const publicApiUrl = process.env.API_PUBLIC_URL || `${protocol}://localhost:${config.apiPort}`;
    injections += `<script>window.API_BASE_URL = '${publicApiUrl}';</script>`;

    // Expose SMS OTP feature flag to the frontend
    injections += `<script>window.SMS_OTP_ENABLED = ${config.enableSmsOtp};</script>`;

    if (!config.enableOidc) {
      // Cleanly inject CSS to hide social buttons rather than doing brittle HTML regex parsing
      injections += '<style>.method-social, .divider { display: none !important; }</style>';
    }
    
    // Inject all scripts and styles right before </head>
    html = html.replace('</head>', `${injections}</head>`);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  router.get('/verify', (_req: Request, res: Response) => {
    const filePath = path.join(_viewsDir, 'verify.html');
    res.sendFile(filePath);
  });

  return router;
}
