import type { RequestHandler, Request, Response, NextFunction } from 'express';

export interface CorsPolicyOptions {
  allowedOrigins: string[]; // empty = block all cross-origin (production default)
  allowAll?: boolean; // true only in non-production when ALLOWED_ORIGINS unset
}

const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const ALLOW_HEADERS = 'Content-Type, Authorization, X-API-Key';

export function createCorsMiddleware(options: CorsPolicyOptions): RequestHandler {
  return function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers['origin'] as string | undefined;

    if (options.allowAll) {
      // Non-production wildcard fallback
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
        res.status(204).end();
        return;
      }

      next();
      return;
    }

    const originMatched = origin !== undefined && options.allowedOrigins.includes(origin);

    if (originMatched) {
      res.setHeader('Access-Control-Allow-Origin', origin!);
      res.setHeader('Vary', 'Origin');
    }
    // If no match: omit the header entirely — browser will block

    if (req.method === 'OPTIONS') {
      if (originMatched) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
        res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
        res.setHeader('Vary', 'Origin');
      }
      res.status(204).end();
      return;
    }

    next();
  };
}
