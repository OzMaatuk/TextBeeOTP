import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { OtpService } from '../services/otpService';
import { config } from '../utils/config';
import { IOtpRepository } from '../repositories/otpRepository';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider';

function isRateLimitedError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const sendSchema = z
  .object({
    recipient: z.string().trim().min(5).max(320),
    channel: z.enum(['sms', 'email']),
  })
  .strict();

const verifySchema = z
  .object({
    recipient: z.string().trim().min(5).max(320),
    code: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/),
  })
  .strict();

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

    try {
      await otpService.sendOTP(recipient, channel);
      return res.status(200).json({ status: 'sent' });
    } catch (err: unknown) {
      req.log.error({ err, recipient, channel }, 'Error sending OTP');
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

    try {
      const ok = await otpService.verifyOTP(recipient, code);
      if (!ok) {
        return res.status(400).json({ error: 'invalid_code' });
      }
      return res.status(200).json({ status: 'verified' });
    } catch (err: unknown) {
      req.log.error({ err, recipient }, 'Error verifying OTP');
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
