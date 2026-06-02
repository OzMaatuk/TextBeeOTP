import request from 'supertest';
import { createServer } from '../src/server';

describe('createServer', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.TEXTBEE_API_KEY;
  const originalDeviceId = process.env.TEXTBEE_DEVICE_ID;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;
  const originalApiKeys = process.env.API_KEYS;
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    // Force in-memory repo — avoids hanging on real Redis connection attempts
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.TEXTBEE_API_KEY = originalApiKey;
    process.env.TEXTBEE_DEVICE_ID = originalDeviceId;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
    process.env.API_KEYS = originalApiKeys;
    process.env.REDIS_URL = originalRedisUrl;
    jest.resetModules();
  });

  it('returns service health information', async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'test-server-key';

    const { apiApp } = createServer();
    const response = await request(apiApp).get('/health').set('X-API-Key', 'test-server-key').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.environment).toBe('test');
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('returns 401 on /otp/send without API key', async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'test-server-key';

    const { apiApp } = createServer();
    await request(apiApp).post('/otp/send').expect(401);
  });

  it('does not expose api docs in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TEXTBEE_API_KEY = 'test-api-key';
    process.env.TEXTBEE_DEVICE_ID = 'test-device-id';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'test-password';
    process.env.API_KEYS = 'test-server-key';
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    process.env.TRUST_PROXY = '1';

    const { apiApp } = createServer();
    await request(apiApp).get('/api-docs').set('X-API-Key', 'test-server-key').expect(404);
  });

  it('includes callback origin in CSP form-action for /verify', async () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'test-server-key';

    const { apiApp } = createServer();
    const callbackUrl = 'https://192.168.0.100/api/otp-callback?return=%2F';
    const response = await request(apiApp)
      .get(`/verify?return=${encodeURIComponent(callbackUrl)}`)
      .expect(200);

    expect(response.headers['content-security-policy']).toMatch(
      /form-action\s+'self'\s+https:\/\/192\.168\.0\.100/
    );
    expect(response.text).toContain(
      `<meta http-equiv="Content-Security-Policy" content="form-action 'self' https://192.168.0.100">`
    );
    expect(response.text).toContain(
      `window.RETURN_URL = ${JSON.stringify(callbackUrl)}`
    );
  });
});
