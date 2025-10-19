import request from 'supertest';
import express from 'express';
import { OtpService } from '../src/services/otpService';
import { TextBeeAdapter } from '../src/providers/textbeeAdapter';
import { RedisOtpRepository } from '../src/repositories/redisOtpRepo';
import Redis from 'ioredis'; // <-- FIX 1: Import the main Redis type
import RedisMock from 'ioredis-mock';
import { Router } from 'express';
import { z } from 'zod';
import { IOtpProvider, OtpChannel } from '../src/providers/otpProvider';
import { EmailAdapter } from '../src/providers/emailAdapter';

// Updated Zod schemas for the new API
const sendSchema = z.object({
  recipient: z.string().min(5).max(50),
  channel: z.enum(['sms', 'email']),
});

const verifySchema = z.object({
  recipient: z.string().min(5).max(50),
  code: z.string().min(4).max(10),
});

// A factory to create the app with all dependencies for testing
function makeTestApp(repo: RedisOtpRepository) {
  const providers = new Map<OtpChannel, IOtpProvider>();
  providers.set('sms', new TextBeeAdapter('', '')); // Mocked, won't actually send
  providers.set('email', new EmailAdapter());

  const otpService = new OtpService(repo, providers);
  const router = Router();

  router.post('/send', async (req, res) => {
    const parse = sendSchema.safeParse(req.body);
    if (!parse.success)
      return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      await otpService.sendOTP(parse.data.recipient, parse.data.channel);
      return res.status(200).json({ status: 'sent' });
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED') return res.status(429).json({ error: 'rate_limited' });
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/verify', async (req, res) => {
    const parse = verifySchema.safeParse(req.body);
    if (!parse.success)
      return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      const ok = await otpService.verifyOTP(parse.data.recipient, parse.data.code);
      if (!ok) return res.status(400).json({ error: 'invalid_code' });
      return res.status(200).json({ status: 'verified' });
    } catch (err: any) {
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/otp', router);
  return app;
}

describe('OTP API Integration (Redis)', () => {
  let app: express.Express;
  let repo: RedisOtpRepository;
  let redisMock: Redis; // <-- FIX 2: Use the imported Redis type

  beforeEach(() => {
    redisMock = new RedisMock();
    repo = new RedisOtpRepository(redisMock);
    app = makeTestApp(repo);

    process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1s window
    process.env.RATE_LIMIT_MAX = '3';
    process.env.OTP_TTL_SECONDS = '60';
  });

  afterEach(() => {
    redisMock.disconnect();
  });

  it('sends and verifies an OTP via SMS channel', async () => {
    const recipient = '+15005550006';
    await request(app).post('/otp/send').send({ recipient, channel: 'sms' }).expect(200);

    const record = await repo.get(recipient);
    expect(record).not.toBeNull();
    if (!record) return;

    const res = await request(app).post('/otp/verify').send({ recipient, code: record.code });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('sends and verifies an OTP via email channel', async () => {
    const recipient = 'test@integration.com';
    await request(app).post('/otp/send').send({ recipient, channel: 'email' }).expect(200);

    const record = await repo.get(recipient);
    expect(record).not.toBeNull();
    if (!record) return;

    const res = await request(app).post('/otp/verify').send({ recipient, code: record.code });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('enforces rate limiting per recipient', async () => {
    const recipient = '+1234567890';
    for (let i = 0; i < 3; i++) {
      await request(app).post('/otp/send').send({ recipient, channel: 'sms' }).expect(200);
    }
    // 4th request should be rate-limited
    await request(app)
      .post('/otp/send')
      .send({ recipient, channel: 'sms' })
      .expect(429, { error: 'rate_limited' });
  });

  it('returns 400 for invalid input on /send', async () => {
    // Missing channel
    await request(app).post('/otp/send').send({ recipient: '+123456' }).expect(400);
    // Invalid channel
    await request(app).post('/otp/send').send({ recipient: '+123456', channel: 'fax' }).expect(400);
    // Missing recipient
    await request(app).post('/otp/send').send({ channel: 'sms' }).expect(400);
  });
});
