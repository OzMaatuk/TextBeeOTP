import request from 'supertest';
import { createServer } from '../src/server';

describe('createServer', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.TEXTBEE_API_KEY;
  const originalDeviceId = process.env.TEXTBEE_DEVICE_ID;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.TEXTBEE_API_KEY = originalApiKey;
    process.env.TEXTBEE_DEVICE_ID = originalDeviceId;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
    jest.resetModules();
  });

  it('returns service health information', async () => {
    process.env.NODE_ENV = 'test';

    const { apiApp } = createServer();
    const response = await request(apiApp).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.environment).toBe('test');
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('does not expose api docs in production', async () => {
    // Set production env and required credentials
    process.env.NODE_ENV = 'production';
    process.env.TEXTBEE_API_KEY = 'test-api-key';
    process.env.TEXTBEE_DEVICE_ID = 'test-device-id';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'test-password';

    const { apiApp } = createServer();
    await request(apiApp).get('/api-docs').expect(404);
  });
});
