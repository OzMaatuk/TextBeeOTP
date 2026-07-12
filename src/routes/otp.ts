import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { OtpService } from '../services/otpService.js';
import { config } from '../utils/config.js';
import { IOtpRepository } from '../repositories/otpRepository.js';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider.js';
import { sendSchema, verifySchema } from '../schemas/otp.js';

function isRateLimitedError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

type RouterDeps = {
  otpService: OtpService;
  repo: IOtpRepository & { getHealthStatus?: () => unknown };
  providers?: Map<OtpChannel, IOtpProvider>;
};

export function createOtpRouter({ otpService, repo, providers }: RouterDeps): Router {
  const router = Router();
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

  router.post('/send', sendLimiter, async (req: Request, res: Response) => {
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
      req.log.error({ err, recipient: maskedRecipient, channel }, 'Error sending OTP');
      if (isRateLimitedError(err) && err.code === 'RATE_LIMITED') {
        return res.status(429).json({ error: 'rate_limited' });
      }
      // Invalid format errors (phone validation, etc.) should be 400, not 502
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid'))) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      return res.status(502).json({ error: 'delivery_failed' });
    }
  });

  router.post('/verify', verifyLimiter, async (req: Request, res: Response) => {
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
      if (!ok) {
        return res.status(400).json({ error: 'invalid_code' });
      }
      return res.status(200).json({ status: 'verified' });
    } catch (err: unknown) {
      req.log.error({ err, recipient: maskedRecipient }, 'Error verifying OTP');
      // Invalid format errors should be 400
      if (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid'))) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.get('/health', (_req: Request, res: Response) => {
    const healthStatus =
      repo.getHealthStatus && typeof repo.getHealthStatus() === 'object'
        ? repo.getHealthStatus()
        : { repository: 'in-memory' };

    const providersHealthy = {
      sms: providers?.has('sms') ? 'configured' : 'not-configured',
      email: providers?.has('email') ? 'configured' : 'not-configured',
    };

    return res.json({
      status: 'ok',
      repository: config.redisUrl ? 'redis' : 'in-memory',
      providers: providersHealthy,
      ...(healthStatus as Record<string, unknown>),
    });
  });

  return router;
}
