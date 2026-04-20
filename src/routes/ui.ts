import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import rateLimit from 'express-rate-limit';
import { config } from '../utils/config.js';
import { OtpService } from '../services/otpService.js';
import { IOtpRepository } from '../repositories/otpRepository.js';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider.js';
import { sendSchema, verifySchema } from '../schemas/otp.js';

// Use process.cwd() to find views directory relative to project root
// This avoids import.meta.url issues in some test environments
const projectRoot = process.cwd();
const getViewsDir = () => {
  // Check if we are running from dist or src
  const isDist = projectRoot.endsWith('dist') || projectRoot.includes('/dist');
  return path.join(projectRoot, isDist ? 'views' : 'src/views');
};
const _viewsDir = getViewsDir();

type UiRouterDeps = {
  otpService: OtpService;
  repo: IOtpRepository;
  providers?: Map<OtpChannel, IOtpProvider>;
};

export function createUiRouter({ otpService, providers }: UiRouterDeps): { pagesRouter: Router; proxyRouter: Router } {
  const pagesRouter = Router();

  // Redirect root to login page
  pagesRouter.get('/', (_req: Request, res: Response) => {
    res.redirect('/login');
  });

  // Serve static JS files from views directory
  pagesRouter.use('/views', express.static(_viewsDir));

  let cachedLoginHtml: string | null = null;

  pagesRouter.get('/login', async (_req: Request, res: Response) => {
    if (!cachedLoginHtml) {
      const filePath = path.join(_viewsDir, 'login.html');
      cachedLoginHtml = await fs.readFile(filePath, 'utf-8');
    }

    let html = cachedLoginHtml;
    let injections = '';

    // UI calls /ui/otp/send and /ui/otp/verify (proxy routes mounted before auth middleware).
    // No API key is exposed to the browser — the proxy calls the OTP service internally.
    const nonce = res.locals.cspNonce ? ` nonce="${res.locals.cspNonce}"` : '';
    injections += `<script${nonce}>window.API_BASE_URL = '/ui';</script>`;

    // Expose SMS OTP feature flag to the frontend
    injections += `<script${nonce}>window.SMS_OTP_ENABLED = ${config.enableSmsOtp};</script>`;

    if (!config.enableOidc) {
      injections += '<style>.method-social, .divider { display: none !important; }</style>';
    }

    html = html.replace('</head>', `${injections}</head>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  let cachedVerifyHtml: string | null = null;

  pagesRouter.get('/verify', async (_req: Request, res: Response) => {
    if (!cachedVerifyHtml) {
      const filePath = path.join(_viewsDir, 'verify.html');
      cachedVerifyHtml = await fs.readFile(filePath, 'utf-8');
    }

    const nonce = res.locals.cspNonce ? ` nonce="${res.locals.cspNonce}"` : '';
    const html = cachedVerifyHtml.replace(
      '</head>',
      `<script${nonce}>window.API_BASE_URL = '/ui';</script></head>`,
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // --- Proxy router: internal OTP routes for the browser UI ---
  // Mounted at /ui on both apiApp (same-port mode) and uiApp (separate-port mode).
  // The browser calls /ui/otp/send and /ui/otp/verify — no API key needed.
  const proxyRouter = Router();

  const sendLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const verifyLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.verifyRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });

  proxyRouter.post('/otp/send', sendLimiter, async (req: Request, res: Response) => {
    const parse = sendSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'invalid_input', details: parse.error.flatten() });
    }
    const { recipient, channel } = parse.data;
    try {
      await otpService.sendOTP(recipient, channel as OtpChannel);
      return res.status(200).json({ status: 'sent' });
    } catch (err: unknown) {
      req.log?.error({ err, recipient, channel }, 'UI proxy: error sending OTP');
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid'))) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      return res.status(502).json({ error: 'delivery_failed' });
    }
  });

  proxyRouter.post('/otp/verify', verifyLimiter, async (req: Request, res: Response) => {
    const parse = verifySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'invalid_input', details: parse.error.flatten() });
    }
    const { recipient, code } = parse.data;
    try {
      const ok = await otpService.verifyOTP(recipient, code);
      if (!ok) return res.status(400).json({ error: 'invalid_code' });
      return res.status(200).json({ status: 'verified' });
    } catch (err: unknown) {
      req.log?.error({ err, recipient }, 'UI proxy: error verifying OTP');
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid'))) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return { pagesRouter, proxyRouter };
}
