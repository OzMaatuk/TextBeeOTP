import { createCorsMiddleware } from '../src/middleware/corsPolicy';
import type { Request, Response, NextFunction } from 'express';

function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeMockRes(): Response & { _headers: Record<string, string>; _status: number | undefined } {
  const headers: Record<string, string> = {};
  const res = {
    _headers: headers,
    _status: undefined as number | undefined,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    getHeader(name: string) {
      return headers[name];
    },
    removeHeader(name: string) {
      delete headers[name];
    },
    status(code: number) {
      this._status = code;
      return this;
    },
    end() {
      return this;
    },
  };
  return res as unknown as Response & { _headers: Record<string, string>; _status: number | undefined };
}

function makeMockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

describe('createCorsMiddleware', () => {
  describe('wildcard mode (allowAll: true)', () => {
    it('sets Access-Control-Allow-Origin: * on all requests', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: [], allowAll: true });
      const req = makeMockReq({ headers: { origin: 'https://any-origin.com' } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
      expect(next).toHaveBeenCalled();
    });

    it('sets * even when no Origin header is present', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: [], allowAll: true });
      const req = makeMockReq();
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('handles OPTIONS preflight with 204 and allow headers in wildcard mode', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: [], allowAll: true });
      const req = makeMockReq({ method: 'OPTIONS', headers: { origin: 'https://any.com' } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(204);
      expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res._headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(res._headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('matched origin', () => {
    it('echoes the matched origin in Access-Control-Allow-Origin', () => {
      const allowedOrigin = 'https://app.example.com';
      const middleware = createCorsMiddleware({ allowedOrigins: [allowedOrigin] });
      const req = makeMockReq({ headers: { origin: allowedOrigin } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBe(allowedOrigin);
      expect(next).toHaveBeenCalled();
    });

    it('echoes the correct origin when multiple origins are configured', () => {
      const origins = ['https://app1.example.com', 'https://app2.example.com'];
      const middleware = createCorsMiddleware({ allowedOrigins: origins });
      const req = makeMockReq({ headers: { origin: origins[1] } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBe(origins[1]);
    });
  });

  describe('unmatched origin', () => {
    it('omits Access-Control-Allow-Origin header for unmatched origin', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: ['https://allowed.com'] });
      const req = makeMockReq({ headers: { origin: 'https://evil.com' } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('omits Access-Control-Allow-Origin when no Origin header is present', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: ['https://allowed.com'] });
      const req = makeMockReq();
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('omits Access-Control-Allow-Origin when allowedOrigins is empty', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: [] });
      const req = makeMockReq({ headers: { origin: 'https://any.com' } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._headers['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  describe('OPTIONS preflight', () => {
    it('responds 204 with Access-Control-Allow-Methods and Access-Control-Allow-Headers for matched origin', () => {
      const allowedOrigin = 'https://app.example.com';
      const middleware = createCorsMiddleware({ allowedOrigins: [allowedOrigin] });
      const req = makeMockReq({ method: 'OPTIONS', headers: { origin: allowedOrigin } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(204);
      expect(res._headers['Access-Control-Allow-Origin']).toBe(allowedOrigin);
      expect(res._headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(res._headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(res._headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
      expect(res._headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(res._headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(res._headers['Access-Control-Allow-Headers']).toContain('X-API-Key');
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 204 without ACAO header for unmatched origin preflight', () => {
      const middleware = createCorsMiddleware({ allowedOrigins: ['https://allowed.com'] });
      const req = makeMockReq({ method: 'OPTIONS', headers: { origin: 'https://evil.com' } } as any);
      const res = makeMockRes();
      const next = makeMockNext();

      middleware(req, res, next);

      expect(res._status).toBe(204);
      expect(res._headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(res._headers['Access-Control-Allow-Methods']).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
