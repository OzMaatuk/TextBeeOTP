import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OtpService } from '../services/otpService';
import { InMemoryOtpRepository } from '../repositories/inMemoryOtpRepo';
import { TextBeeAdapter } from '../providers/textbeeAdapter';
import { RedisOtpRepository } from '../repositories/redisOtpRepo';
import { EmailAdapter } from '../providers/emailAdapter';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider';
import { config } from '../utils/config';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger();

const sendSchema = z.object({
  recipient: z.string().min(5).max(50), // Can be phone or email
  channel: z.enum(['sms', 'email']),
});

const verifySchema = z.object({
  recipient: z.string().min(5).max(50),
  code: z.string().min(4).max(10),
});

// --- Dependency Injection ---
let repo;
if (config.redisUrl) {
  logger.info({ redisUrl: config.redisUrl.replace(/:[^:@]+@/, ':****@') }, '[OTP Routes] Using Redis repository');
  repo = new RedisOtpRepository(config.redisUrl, logger);
} else {
  logger.warn('[OTP Routes] No REDIS_URL configured, using in-memory repository');
  repo = new InMemoryOtpRepository();
}

const providers = new Map<OtpChannel, IOtpProvider>();
providers.set(
  'sms',
  new TextBeeAdapter(config.textbeeApiKey || '', config.textbeeDeviceId || '', undefined, logger)
);
providers.set('email', new EmailAdapter(undefined, config.emailFrom, logger));

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
    if (req.log) {
      req.log.error({ err, recipient, channel }, 'Error sending OTP');
    }
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
    if (req.log) {
      req.log.error({ err, recipient }, 'Error verifying OTP');
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  const healthStatus = (repo as any).getHealthStatus ? (repo as any).getHealthStatus() : { type: 'in-memory' };
  return res.json({
    repository: config.redisUrl ? 'redis' : 'in-memory',
    redisUrl: config.redisUrl ? config.redisUrl.replace(/:[^:@]+@/, ':****@') : null,
    ...healthStatus,
  });
});

router.get('/test-redis', async (req: Request, res: Response) => {
  try {
    const testKey = 'test:connection:' + Date.now();
    const testValue = 'test-value-' + Date.now();
    
    await repo.save({
      recipient: testKey,
      code: testValue,
      expiresAt: Date.now() + 60000,
      createdAt: Date.now(),
    });
    
    const retrieved = await repo.get(testKey);
    await repo.delete(testKey);
    
    if (req.log) {
      req.log.info({ testKey, retrieved: !!retrieved }, '[Test Redis] Write/Read test completed');
    }
    
    return res.json({
      success: !!retrieved,
      message: retrieved ? 'Redis write/read successful' : 'Data not found - likely using in-memory fallback',
      healthStatus: (repo as any).getHealthStatus ? (repo as any).getHealthStatus() : { type: 'in-memory' },
    });
  } catch (err: any) {
    if (req.log) {
      req.log.error({ err }, '[Test Redis] Test failed');
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

export const otpRouter = router;
