import request from 'supertest';
import { createServer } from '../src/server';

const API_KEY = 'test-api-auth-key';
const SECRET = 'test-auth-token-secret';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.API_KEYS = API_KEY;
  process.env.AUTH_TOKEN_SECRET = SECRET;
  process.env.AUTH_TOKEN_TTL_SECONDS = '300';
  delete process.env.REDIS_URL;
});

afterEach(() => {
  jest.resetModules();
});

describe('GET /api/auth/validate', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const { apiApp } = createServer();
    const res = await request(apiApp).get('/api/auth/validate').set('X-API-Key', API_KEY);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('returns 401 for an invalid token', async () => {
    const { apiApp } = createServer();
    const res = await request(apiApp)
      .get('/api/auth/validate')
      .set('X-API-Key', API_KEY)
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('returns 401 without API key', async () => {
    const { apiApp } = createServer();
    const res = await request(apiApp).get('/api/auth/validate').set('Authorization', 'Bearer sometoken');

    expect(res.status).toBe(401);
  });

  it('returns 200 with payload for a valid token', async () => {
    const { generateAuthToken } = await import('../src/utils/jwt');
    const token = generateAuthToken('user@example.com');

    const { apiApp } = createServer();
    const res = await request(apiApp)
      .get('/api/auth/validate')
      .set('X-API-Key', API_KEY)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.email).toBe('user@example.com');
    expect(res.body.sub).toBe('user@example.com');
    expect(typeof res.body.exp).toBe('number');
  });
});
