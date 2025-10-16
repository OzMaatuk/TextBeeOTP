import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OtpService } from '../services/otpService';
import { InMemoryOtpRepository } from '../repositories/inMemoryOtpRepo';
import { TextBeeAdapter } from '../providers/textbeeAdapter';
import { RedisOtpRepository } from '../repositories/redisOtpRepo';

const router = Router();

const sendSchema = z.object({
  phone: z.string().min(7).max(20),
});

const verifySchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(10),
});

// For simplicity, wire dependencies here. In larger apps use DI container.
const repo = process.env.REDIS_URL ? new RedisOtpRepository(process.env.REDIS_URL) : new InMemoryOtpRepository();
const provider = new TextBeeAdapter(process.env.TEXTBEE_API_KEY || '', process.env.TEXTBEE_DEVICE_ID || '', process.env.TEXTBEE_API_BASE || 'https://api.textbee.dev/api/v1');
const otpService = new OtpService(repo, provider);

router.post('/send', async (req: Request<unknown, unknown, { phone: string }>, res: Response) => {
  const parse = sendSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });

  try {
    await otpService.sendOTP(parse.data.phone);
    return res.status(200).json({ status: 'sent' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err && err.code === 'RATE_LIMITED') {
      if (req.log) req.log.warn({ phone: parse.data.phone }, 'Rate limit exceeded for phone');
      return res.status(429).json({ error: 'rate_limited' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/verify', async (req: Request<unknown, unknown, { phone: string; code: string }>, res: Response) => {
  const parse = verifySchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });

  try {
    const ok = await otpService.verifyOTP(parse.data.phone, parse.data.code);
    if (!ok) return res.status(400).json({ error: 'invalid_code' });
    return res.status(200).json({ status: 'verified' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export const otpRouter = router;
