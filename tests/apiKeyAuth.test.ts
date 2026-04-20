import { createApiKeyAuth } from '../src/middleware/apiKeyAuth';
import type { Request, Response, NextFunction } from 'express';
import type { KeyStoreEntry } from '../src/utils/securityConfig';

// --- Helpers ---

function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/otp/send',
    method: 'POST',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeMockRes() {
  const res = {
    _status: undefined as number | undefined,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res as typeof res & Response;
}

function makeMockNext(): jest.Mock {
  return jest.fn();
}

function makeMockLogger() {
  return {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  } as any;
}

const VALID_KEY = 'super-secret-key-abc123';
const HEALTH_KEY = 'health-monitor-key-xyz';

const mainKeys: KeyStoreEntry[] = [{ name: 'key-1', key: VALID_KEY, enabled: true }];
const healthKeys: KeyStoreEntry[] = [{ name: 'health-key', key: HEALTH_KEY, enabled: true }];

// --- Unit Tests ---

describe('createApiKeyAuth', () => {
  describe('missing X-API-Key header', () => {
    it('returns 401 with {"error":"unauthorized"} when header is absent', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: {} });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: 'unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('logs warn with path, method, ip, and reason=missing_key', () => {
      const logger = makeMockLogger();
      const middleware = createApiKeyAuth({ keys: mainKeys, logger });
      const req = makeMockReq({ headers: {}, path: '/otp/send', method: 'POST', ip: '1.2.3.4' });
      const res = makeMockRes();

      middleware(req, res, makeMockNext());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/otp/send', method: 'POST', ip: '1.2.3.4', reason: 'missing_key' }),
        'auth_failure',
      );
    });
  });

  describe('wrong key value', () => {
    it('returns 401 with {"error":"unauthorized"} when key does not match', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': 'wrong-key' } });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: 'unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('logs warn with reason=invalid_key', () => {
      const logger = makeMockLogger();
      const middleware = createApiKeyAuth({ keys: mainKeys, logger });
      const req = makeMockReq({ headers: { 'x-api-key': 'bad-key' } });
      const res = makeMockRes();

      middleware(req, res, makeMockNext());

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'invalid_key' }),
        'auth_failure',
      );
    });
  });

  describe('correct key', () => {
    it('calls next() when the correct key is provided', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': VALID_KEY } });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBeUndefined();
    });

    it('attaches keyName to req', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': VALID_KEY } });
      const res = makeMockRes();

      middleware(req, res, makeMockNext());

      expect((req as any).keyName).toBe('key-1');
    });

    it('logs debug with path and keyName — never the key value', () => {
      const logger = makeMockLogger();
      const middleware = createApiKeyAuth({ keys: mainKeys, logger });
      const req = makeMockReq({ headers: { 'x-api-key': VALID_KEY }, path: '/otp/send' });
      const res = makeMockRes();

      middleware(req, res, makeMockNext());

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/otp/send', keyName: 'key-1' }),
        'auth_success',
      );
      const [logObj] = logger.debug.mock.calls[0];
      expect(JSON.stringify(logObj)).not.toContain(VALID_KEY);
    });
  });

  describe('health key on health routes', () => {
    it('accepts health key on /health', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, healthKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': HEALTH_KEY }, path: '/health' });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._status).toBeUndefined();
    });

    it('accepts health key on /otp/health', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, healthKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': HEALTH_KEY }, path: '/otp/health' });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('rejects health key on /otp/send with 401', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, healthKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': HEALTH_KEY }, path: '/otp/send' });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: 'unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects health key on /otp/verify with 401', () => {
      const middleware = createApiKeyAuth({ keys: mainKeys, healthKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': HEALTH_KEY }, path: '/otp/verify' });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('disabled keys', () => {
    it('rejects a disabled key', () => {
      const disabledKeys: KeyStoreEntry[] = [{ name: 'key-1', key: VALID_KEY, enabled: false }];
      const middleware = createApiKeyAuth({ keys: disabledKeys, logger: makeMockLogger() });
      const req = makeMockReq({ headers: { 'x-api-key': VALID_KEY } });
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
