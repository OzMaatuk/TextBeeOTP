import express, { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import rateLimit from 'express-rate-limit';
import { config } from '../utils/config.js';
import { OtpService } from '../services/otpService.js';
import { IOtpRepository } from '../repositories/otpRepository.js';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider.js';
import { sendSchema, verifySchema } from '../schemas/otp.js';
import { generateAuthToken } from '../utils/jwt.js';
import { loadSecurityConfig } from '../utils/securityConfig.js';
import { createLogger } from '../utils/logger.js';

// Use process.cwd() to find views directory relative to project root
// This avoids import.meta.url issues in some test environments
const projectRoot = process.cwd();
const getViewsDir = () => {
  // Check if we are running from dist or src
  const isDist = projectRoot.endsWith('dist') || projectRoot.includes('/dist');
  return path.join(projectRoot, isDist ? 'views' : 'src/views');
};
const _viewsDir = getViewsDir();
const logger = createLogger();

type UiRouterDeps = {
  otpService: OtpService;
  repo: IOtpRepository;
  providers?: Map<OtpChannel, IOtpProvider>;
};

function validateReturnUrl(rawUrl: string | undefined, allowedOrigins: string[], allowAll: boolean): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (process.env.NODE_ENV === 'test' || allowAll || allowedOrigins.includes(parsed.origin)) {
      return rawUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export function createUiRouter({ otpService, providers }: UiRouterDeps): { pagesRouter: Router; proxyRouter: Router } {
  const pagesRouter = Router();
  const securityConfig = loadSecurityConfig(logger);
  void providers;

  // Redirect root to login page
  pagesRouter.get('/', (_req: Request, res: Response) => {
    res.redirect('/login');
  });

  // Serve static JS files from views directory
  pagesRouter.use('/views', express.static(_viewsDir));

  let cachedLoginHtml: string | null = null;

  pagesRouter.get('/login', async (req: Request, res: Response) => {
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

    // Add return URL parameter support - validated to prevent open redirect
    const returnUrl = validateReturnUrl(req.query.return as string, securityConfig.allowedOrigins, securityConfig.allowAllOrigins);
    injections += `<script${nonce}>window.RETURN_URL = ${JSON.stringify(returnUrl || '')};</script>`;

    if (!config.enableOidc) {
      injections += '<style>.method-social, .divider { display: none !important; }</style>';
    }

    html = html.replace('</head>', `${injections}</head>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  let cachedVerifyHtml: string | null = null;

  pagesRouter.get('/verify', async (req: Request, res: Response) => {
    if (!cachedVerifyHtml) {
      const filePath = path.join(_viewsDir, 'verify.html');
      cachedVerifyHtml = await fs.readFile(filePath, 'utf-8');
    }

    const returnUrl = validateReturnUrl(req.query.return as string, securityConfig.allowedOrigins, securityConfig.allowAllOrigins);
    const nonce = res.locals.cspNonce ? ` nonce="${res.locals.cspNonce}"` : '';
    let html = cachedVerifyHtml;
    let metaCsp = '';

    if (returnUrl) {
      try {
        const returnOrigin = new URL(returnUrl).origin;
        const currentCsp = res.getHeader('Content-Security-Policy');
        let cspString = '';

        if (typeof currentCsp === 'string') {
          cspString = currentCsp;
        } else if (Array.isArray(currentCsp)) {
          cspString = currentCsp.join('; ');
        }

        if (cspString.length > 0) {
          if (cspString.includes('form-action')) {
            cspString = cspString.replace(/form-action\s+[^;]+/, (match) => {
              return match.includes(returnOrigin) ? match : `${match} ${returnOrigin}`;
            });
          } else {
            cspString = `${cspString}; form-action 'self' ${returnOrigin}`;
          }
          res.setHeader('Content-Security-Policy', cspString);
        }

        metaCsp = `<meta http-equiv="Content-Security-Policy" content="form-action 'self' ${returnOrigin}">`;
      } catch {
        // Ignore invalid return URL; fallback to default CSP
      }
    }

    html = html.replace(
      '</head>',
      `${metaCsp}<script${nonce}>window.API_BASE_URL = '/ui'; window.RETURN_URL = ${JSON.stringify(returnUrl || '')}; window.OTP_TTL_SECONDS = ${config.otpTtlSeconds};</script></head>`
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
    const maskedRecipient = recipient.includes('@')
      ? recipient.replace(/^([^@]{1,2})[^@]*@/, '$1***@')
      : recipient.substring(0, 3) + '***' + recipient.slice(-4);
    try {
      await otpService.sendOTP(recipient, channel as OtpChannel);
      return res.status(200).json({ status: 'sent' });
    } catch (err: unknown) {
      req.log?.error({ err, recipient: maskedRecipient, channel }, 'UI proxy: error sending OTP');
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
    const maskedRecipient = recipient.includes('@')
      ? recipient.replace(/^([^@]{1,2})[^@]*@/, '$1***@')
      : recipient.substring(0, 3) + '***' + recipient.slice(-4);
    try {
      const ok = await otpService.verifyOTP(recipient, code);
      if (!ok) return res.status(400).json({ error: 'invalid_code' });

      const token = generateAuthToken(recipient);

      return res.status(200).json({
        status: 'verified',
        email: recipient,
        token,
      });
    } catch (err: unknown) {
      req.log?.error({ err, recipient: maskedRecipient }, 'UI proxy: error verifying OTP');
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid'))) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  return { pagesRouter, proxyRouter };
}
