declare module 'oidc-provider' {
  import { Express, Request, Response, NextFunction } from 'express';

  interface ProviderConfig {
    clients?: any[];
    claims?: Record<string, string[]>;
    scopes?: string[];
    features?: Record<string, any>;
    ttl?: Record<string, number>;
    interactions?: Record<string, any>;
    findById?: (ctx: any, id: string) => Promise<any>;
  }

  class Provider {
    constructor(issuer: string, config: ProviderConfig);
    discovery(req: Request, res: Response): Promise<void>;
    authorization(req: Request, res: Response, next?: NextFunction): Promise<void>;
    token(req: Request, res: Response, next?: NextFunction): Promise<void>;
    userinfo(req: Request, res: Response, next?: NextFunction): Promise<void>;
    interactionDetails(req: Request, res: Response): Promise<any>;
    interactionFinished(req: Request, res: Response, result: any): Promise<void>;
  }

  export default Provider;
}
