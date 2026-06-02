declare module 'oidc-provider' {
  import { Request, Response, NextFunction } from 'express';

  interface ProviderConfig {
    clients?: Array<Record<string, unknown>>;
    claims?: Record<string, string[]>;
    scopes?: string[];
    features?: Record<string, unknown>;
    ttl?: Record<string, number>;
    interactions?: Record<string, unknown>;
    findById?: (ctx: unknown, id: string) => Promise<unknown>;
  }

  class Provider {
    constructor(issuer: string, config: ProviderConfig);
    discovery(req: Request, res: Response): Promise<void>;
    authorization(req: Request, res: Response, next?: NextFunction): Promise<void>;
    token(req: Request, res: Response, next?: NextFunction): Promise<void>;
    userinfo(req: Request, res: Response, next?: NextFunction): Promise<void>;
    interactionDetails(req: Request, res: Response): Promise<unknown>;
    interactionFinished(req: Request, res: Response, result: unknown): Promise<void>;
  }

  export default Provider;
}
