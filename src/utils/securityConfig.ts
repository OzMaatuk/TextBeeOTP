import type { Logger } from 'pino';
import { config } from './config.js';

export interface KeyStoreEntry {
  name: string;
  key: string;
  enabled: boolean;
}

export interface SecurityConfig {
  apiKeys: KeyStoreEntry[];
  healthApiKey?: KeyStoreEntry;
  allowedOrigins: string[];
  allowAllOrigins: boolean;
  trustProxy: string | number | false;
}

function parseTrustProxy(raw: string): string | number | false {
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && /^\d+$/.test(raw.trim())) return num;
  return raw;
}

export function loadSecurityConfig(logger: Logger): SecurityConfig {
  const isProduction = config.isProduction;

  // --- API_KEYS ---
  let apiKeys: KeyStoreEntry[] = [];
  const rawApiKeys = config.apiKeys;
  if (rawApiKeys && rawApiKeys.trim().length > 0) {
    apiKeys = rawApiKeys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .map((k, i) => ({ name: `key-${i + 1}`, key: k, enabled: true }));
  }

  if (apiKeys.length === 0) {
    if (isProduction) {
      throw new Error('Security configuration error: API_KEYS is required in production');
    }
    logger.warn('API_KEYS is not configured; API key authentication is disabled');
  }

  // --- ALLOWED_ORIGINS ---
  let allowedOrigins: string[] = [];
  let allowAllOrigins = false;
  const rawAllowedOrigins = config.allowedOrigins;
  if (rawAllowedOrigins && rawAllowedOrigins.trim().length > 0) {
    allowedOrigins = rawAllowedOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  if (allowedOrigins.length === 0) {
    if (isProduction) {
      throw new Error('Security configuration error: ALLOWED_ORIGINS is required in production');
    }
    logger.warn('ALLOWED_ORIGINS is not configured; allowing all origins (*)');
    allowAllOrigins = true;
  }

  // --- TRUST_PROXY ---
  let trustProxy: string | number | false = 1;
  const rawTrustProxy = config.trustProxy;
  if (rawTrustProxy !== undefined && rawTrustProxy.trim().length > 0) {
    trustProxy = parseTrustProxy(rawTrustProxy.trim());
  } else {
    if (isProduction) {
      throw new Error('Security configuration error: TRUST_PROXY is required in production');
    }
    logger.warn('TRUST_PROXY is not configured; defaulting to 1');
  }

  // --- HEALTH_API_KEY (optional) ---
  let healthApiKey: KeyStoreEntry | undefined;
  const rawHealthApiKey = config.healthApiKey;
  if (rawHealthApiKey && rawHealthApiKey.trim().length > 0) {
    healthApiKey = { name: 'health-key', key: rawHealthApiKey.trim(), enabled: true };
  }

  // Startup summary — never log key values
  logger.info({
    allowedOrigins,
    trustProxy,
    apiKeyCount: apiKeys.length,
  }, 'Security configuration loaded');

  return {
    apiKeys,
    healthApiKey,
    allowedOrigins,
    allowAllOrigins,
    trustProxy,
  };
}
