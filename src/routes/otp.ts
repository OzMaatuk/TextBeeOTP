import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OtpService } from '../services/otpService';
import { InMemoryOtpRepository } from '../repositories/inMemoryOtpRepo';
import { TextBeeAdapter } from '../providers/textbeeAdapter';
import { RedisOtpRepository } from '../repositories/redisOtpRepo';
import { EmailAdapter } from '../providers/emailAdapter';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider';
import { config } from '../utils/config';

const router = Router();

const sendSchema = z.object({
  recipient: z.string().min(5).max(50), // Can be phone or email
  channel: z.enum(['sms', 'email']),
});

const verifySchema = z.object({
  recipient: z.string().min(5).max(50),
  code: z.string().min(4).max(10),
});

// --- Dependency Injection ---
const repo = config.redisUrl
  ? new RedisOtpRepository(config.redisUrl)
  : new InMemoryOtpRepository();

const providers = new Map<OtpChannel, IOtpProvider>();
providers.set(
  'sms',
  new TextBeeAdapter(config.textbeeApiKey || '', config.textbeeDeviceId || '')
);
providers.set('email', new EmailAdapter(undefined, config.emailFrom));

const otpService = new OtpService(repo, providers);
// --------------------------

router.post('/send', async (req: Request, res: Response) => {
  const parse = sendSchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
  const { recipient, channel } = parse.data;

  try {
    await otpService.sendOTP(recipient, channel);
    return res.status(200).json({ status: 'sent' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err && err.code === 'RATE_LIMITED') {
      if (req.log) req.log.warn({ recipient }, 'Rate limit exceeded for recipient');
      return res.status(429).json({ error: 'rate_limited' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const parse = verifySchema.safeParse(req.body);
  if (!parse.success)
    return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
  const { recipient, code } = parse.data;

  try {
    const ok = await otpService.verifyOTP(recipient, code);
    if (!ok) return res.status(400).json({ error: 'invalid_code' });
    return res.status(200).json({ status: 'verified' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export const otpRouter = router;
