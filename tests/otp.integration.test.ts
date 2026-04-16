import request from 'supertest';
import express from 'express';
import { OtpService } from '../src/services/otpService';
import { RedisOtpRepository } from '../src/repositories/redisOtpRepo';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { Router } from 'express';
import { IOtpProvider, OtpChannel } from '../src/providers/otpProvider';
import { normalizeRecipient } from '../src/utils/recipient';
import { sendSchema, verifySchema } from '../src/schemas/otp';

function isRateLimitedError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

class MockProvider implements IOtpProvider {
  public lastMessageByRecipient = new Map<string, string>();

  async sendOtp(recipient: string, message: string): Promise<void> {
    this.lastMessageByRecipient.set(recipient, message);
  }

  getCode(recipient: string): string {
    const message = this.lastMessageByRecipient.get(recipient);
    const match = message?.match(/(\d{4,10})/);
    if (!match) {
      throw new Error(`OTP code not found for ${recipient}`);
    }
    return match[1];
  }
}

// A factory to create the app with all dependencies for testing
function makeTestApp(repo: RedisOtpRepository) {
  const providers = new Map<OtpChannel, IOtpProvider>();
  const smsProvider = new MockProvider();
  const emailProvider = new MockProvider();
  providers.set('sms', smsProvider);
  providers.set('email', emailProvider);

  const otpService = new OtpService(repo, providers);
  const router = Router();

  router.post('/send', async (req, res) => {
    const parse = sendSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      await otpService.sendOTP(parse.data.recipient, parse.data.channel as OtpChannel);
      return res.status(200).json({ status: 'sent' });
    } catch (err: unknown) {
      if (isRateLimitedError(err) && err.code === 'RATE_LIMITED') {
        return res.status(429).json({ error: 'rate_limited' });
      }
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  router.post('/verify', async (req, res) => {
    const parse = verifySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: 'invalid_input', details: parse.error.format() });
    try {
      const ok = await otpService.verifyOTP(parse.data.recipient, parse.data.code);
      if (!ok) return res.status(400).json({ error: 'invalid_code' });
      return res.status(200).json({ status: 'verified' });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/otp', router);
  return { app, smsProvider, emailProvider };
}

describe('OTP API Integration (Redis)', () => {
  let app: express.Express;
  let repo: RedisOtpRepository;
  let redisMock: Redis;
  let smsProvider: MockProvider;
  let emailProvider: MockProvider;

  beforeEach(() => {
    jest.setTimeout(10000); // Increase timeout for integration tests
    redisMock = new RedisMock();
    repo = new RedisOtpRepository(redisMock);
    ({ app, smsProvider, emailProvider } = makeTestApp(repo));

    process.env.RATE_LIMIT_WINDOW_MS = '1000'; // 1s window
    process.env.RATE_LIMIT_MAX = '3';
    process.env.OTP_TTL_SECONDS = '60';
    process.env.ENABLE_SMS_OTP = 'true'; // integration tests exercise the SMS channel directly
  });

  afterEach(async () => {
    await redisMock.disconnect();
  });

  it('sends and verifies an OTP via SMS channel', async () => {
    const recipient = '+15005550006';
    await request(app).post('/otp/send').send({ recipient, channel: 'sms' }).expect(200);

    const normalizedRecipient = normalizeRecipient(recipient, 'sms');
    const record = await repo.get(normalizedRecipient);
    expect(record).not.toBeNull();

    const res = await request(app)
      .post('/otp/verify')
      .send({ recipient, code: smsProvider.getCode(normalizedRecipient) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('sends and verifies an OTP via email channel', async () => {
    const recipient = 'test@integration.com';
    await request(app).post('/otp/send').send({ recipient, channel: 'email' }).expect(200);

    const normalizedRecipient = normalizeRecipient(recipient, 'email');
    const record = await repo.get(normalizedRecipient);
    expect(record).not.toBeNull();

    const res = await request(app)
      .post('/otp/verify')
      .send({ recipient, code: emailProvider.getCode(normalizedRecipient) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('enforces rate limiting per recipient', async () => {
    const recipient = '+1234567890';
    for (let i = 0; i < 3; i++) {
      await request(app).post('/otp/send').send({ recipient, channel: 'sms' }).expect(200);
    }
    // 4th request should be rate-limited
    await request(app).post('/otp/send').send({ recipient, channel: 'sms' }).expect(429, { error: 'rate_limited' });
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
