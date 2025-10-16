import request from 'supertest';
import express from 'express';
import { OtpService } from '../src/services/otpService';
import { TextBeeAdapter } from '../src/providers/textbeeAdapter';
import { RedisOtpRepository } from '../src/repositories/redisOtpRepo';
import RedisMock from 'ioredis-mock';
import { Router } from 'express';
import { z } from 'zod';

// Patch RedisOtpRepository to use ioredis-mock
class TestRedisOtpRepository extends RedisOtpRepository {
  constructor() {
    super();
    // @ts-ignore
    this.client = new RedisMock();
  }
}

const sendSchema = z.object({ phone: z.string().min(7).max(20) });
const verifySchema = z.object({ phone: z.string().min(7).max(20), code: z.string().min(4).max(10) });

function makeApp(repo: RedisOtpRepository) {
  const provider = new TextBeeAdapter('', '', '');
  const otpService = new OtpService(repo, provider);
  const router = Router();

  router.post('/send', async (req, res) => {
    const parse = sendSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      await otpService.sendOTP(parse.data.phone);
      return res.status(200).json({ status: 'sent' });
    } catch (err: any) {
      if (err && err.code === 'RATE_LIMITED') return res.status(429).json({ error: 'rate_limited' });
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/verify', async (req, res) => {
    const parse = verifySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      const ok = await otpService.verifyOTP(parse.data.phone, parse.data.code);
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

describe('OTP API integration (Redis)', () => {
  let app: express.Express;
  let repo: TestRedisOtpRepository;
  beforeEach(() => {
    repo = new TestRedisOtpRepository();
    app = makeApp(repo);
    process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1s window for test
    process.env.RATE_LIMIT_MAX = '3';
    process.env.OTP_LENGTH = '6';
    process.env.OTP_TTL_SECONDS = '60';
  });

  it('allows up to RATE_LIMIT_MAX sends per window', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/otp/send').send({ phone: '+1234567890' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('sent');
    }
    // 4th should be rate-limited
    const res = await request(app).post('/otp/send').send({ phone: '+1234567890' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  });

  it('resets rate limit after window', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/otp/send').send({ phone: '+1234567890' });
    }
    await new Promise(r => setTimeout(r, 1100)); // wait for window to expire
    const res = await request(app).post('/otp/send').send({ phone: '+1234567890' });
    expect(res.status).toBe(200);
  });

  it('stores OTP in Redis and verifies', async () => {
    await request(app).post('/otp/send').send({ phone: '+1234567890' });
    const record = await repo.get('+1234567890');
    expect(record).not.toBeNull();
    if (record) {
      const res = await request(app).post('/otp/verify').send({ phone: '+1234567890', code: record.code });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('verified');
    }
  });
});
