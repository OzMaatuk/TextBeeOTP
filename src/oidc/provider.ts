import { Express } from 'express';
import { config } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

// Polyfill for URL.parse - added in Node.js 19.4+
// This allows oidc-provider to work with Node.js 18.x
if (!URL.parse) {
  (URL as any).parse = function (url: string) {
    return new URL(url);
  };
}

// In-memory account storage for external identities
interface ExternalAccount {
  accountId: string;
  sub: string; // Subject from external provider
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  provider?: string; // e.g., 'google', 'facebook'
}

const externalAccounts = new Map<string, ExternalAccount>();

/**
 * Creates a minimal OIDC provider for use with oauth2-proxy.
 * This provider is meant to work with external identity providers (Google, Facebook, etc.)
 * and does NOT handle login directly. oauth2-proxy handles the actual authentication.
 *
 * For OTP-based authentication, use the /otp endpoints directly.
 */
export async function createOidcProvider(app: Express): Promise<any> {
  const { default: Provider } = await import('oidc-provider');
  const { v4: uuidv4 } = await import('uuid');
  const baseUrl = config.oidcServerUrl || `http://localhost:${config.apiPort}`;
  const clientId = config.oidcClientId || 'oauth2-proxy';
  const clientSecret = config.oidcClientSecret || uuidv4();

  const provider = new Provider(baseUrl, {
    clients: [
      {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: config.oidcRedirectUris || ['http://localhost:4180/oauth2/callback'],
        response_types: ['code'],
        grant_types: ['authorization_code', 'refresh_token'],
      },
    ],
    claims: {
      openid: ['sub'],
      profile: ['email', 'email_verified', 'name', 'picture'],
      email: ['email', 'email_verified'],
    },
    scopes: ['openid', 'profile', 'email'],
    features: {
      devInteractions: { enabled: false },
      rpInitiatedLogout: { enabled: true },
    },
    ttl: {
      AccessToken: 3600, // 1 hour
      AuthorizationCode: 600, // 10 minutes
      IdToken: 3600,
      RefreshToken: 7 * 24 * 3600, // 7 days
      Session: 7 * 24 * 3600,
    },
    async findById(_ctx: any, id: string) {
      const account = externalAccounts.get(id);
      if (!account) {
        return undefined;
      }
      return {
        accountId: account.accountId,
        async claims(use: string, _scope: string) {
          if (use === 'id_token') {
            return {
              sub: account.accountId,
              email: account.email,
              email_verified: account.email_verified || false,
              name: account.name,
              picture: account.picture,
            };
          }
          if (use === 'userinfo') {
            return {
              sub: account.accountId,
              email: account.email,
              email_verified: account.email_verified || false,
              name: account.name,
              picture: account.picture,
            };
          }
          return {
            sub: account.accountId,
          };
        },
      };
    },
  });

  // OIDC Discovery endpoint
  app.get('/.well-known/openid-configuration', async (req, res, next) => {
    try {
      return provider.discovery(req, res);
    } catch (err) {
      next(err);
    }
  });

  // Authorization endpoint (redirects to external provider)
  app.get('/oauth2/authorize', async (req, res, next) => {
    try {
      return provider.authorization(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  // Token endpoint (exchanges auth code for token)
  app.post('/oauth2/token', async (req, res, next) => {
    try {
      return provider.token(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  // UserInfo endpoint (returns user info from token)
  app.get('/oauth2/userinfo', async (req, res, next) => {
    try {
      return provider.userinfo(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  // Internal endpoint to create/update account from external provider
  app.post('/oauth2/account', (req, res) => {
    const { sub, email, email_verified, name, picture, provider: authProvider } = req.body;

    if (!sub) {
      return res.status(400).json({ error: 'Missing sub (subject) from external provider' });
    }

    const accountId = `${authProvider}_${uuidv4()}`;
    const account: ExternalAccount = {
      accountId,
      sub,
      email,
      email_verified: email_verified || false,
      name,
      picture,
      provider: authProvider,
    };

    externalAccounts.set(accountId, account);
    logger.info({ accountId, provider: authProvider, email }, 'Created account from external provider');

    res.json({ accountId, sub: accountId });
  });

  // Endpoint to get account info (for testing)
  app.get('/oauth2/account/:accountId', (req, res) => {
    const { accountId } = req.params;
    const account = externalAccounts.get(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  });

  logger.info(
    { clientId, issuer: baseUrl, redirectUris: config.oidcRedirectUris },
    'OIDC provider configured for external authentication'
  );

  return provider;
}
