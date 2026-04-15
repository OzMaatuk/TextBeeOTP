import request from 'supertest';
import { createServer } from '../src/server';

describe('createServer', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('returns service health information', async () => {
    process.env.NODE_ENV = 'test';

    const app = createServer();
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.environment).toBe('test');
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it('does not expose api docs in production', async () => {
    process.env.NODE_ENV = 'production';

    const app = createServer();
    await request(app).get('/api-docs').expect(404);
  });
});
