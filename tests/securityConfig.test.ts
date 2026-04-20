import { loadSecurityConfig } from '../src/utils/securityConfig';

// Mock the config module
jest.mock('../src/utils/config', () => ({
  config: {
    isProduction: false,
    apiKeys: undefined as string | undefined,
    allowedOrigins: undefined as string | undefined,
    trustProxy: undefined as string | undefined,
    healthApiKey: undefined as string | undefined,
  },
}));

import { config } from '../src/utils/config';

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

// Helper to set config values
function setConfig(overrides: {
  isProduction?: boolean;
  apiKeys?: string;
  allowedOrigins?: string;
  trustProxy?: string;
  healthApiKey?: string;
}) {
  const c = config as any;
  c.isProduction = overrides.isProduction ?? false;
  c.apiKeys = overrides.apiKeys;
  c.allowedOrigins = overrides.allowedOrigins;
  c.trustProxy = overrides.trustProxy;
  c.healthApiKey = overrides.healthApiKey;
}

beforeEach(() => {
  setConfig({});
});

describe('loadSecurityConfig', () => {
  describe('production validation', () => {
    it('throws with "API_KEYS" in message when API_KEYS is missing in production', () => {
      setConfig({ isProduction: true, allowedOrigins: 'https://example.com', trustProxy: '1' });
      expect(() => loadSecurityConfig(makeMockLogger())).toThrow(/API_KEYS/);
    });

    it('throws with "ALLOWED_ORIGINS" in message when ALLOWED_ORIGINS is missing in production', () => {
      setConfig({ isProduction: true, apiKeys: 'secret-key', trustProxy: '1' });
      expect(() => loadSecurityConfig(makeMockLogger())).toThrow(/ALLOWED_ORIGINS/);
    });

    it('throws with "TRUST_PROXY" in message when TRUST_PROXY is missing in production', () => {
      setConfig({ isProduction: true, apiKeys: 'secret-key', allowedOrigins: 'https://example.com' });
      expect(() => loadSecurityConfig(makeMockLogger())).toThrow(/TRUST_PROXY/);
    });
  });

  describe('non-production fallbacks', () => {
    it('returns safe defaults without throwing when all vars are missing in non-production', () => {
      setConfig({ isProduction: false });
      const logger = makeMockLogger();
      const result = loadSecurityConfig(logger);

      expect(result.apiKeys).toEqual([]);
      expect(result.allowedOrigins).toEqual([]);
      expect(result.allowAllOrigins).toBe(true);
      expect(result.trustProxy).toBe(1);
      expect(result.healthApiKey).toBeUndefined();
    });

    it('logs warnings for each missing config in non-production', () => {
      setConfig({ isProduction: false });
      const logger = makeMockLogger();
      loadSecurityConfig(logger);

      expect(logger.warn).toHaveBeenCalledTimes(3);
    });
  });

  describe('TRUST_PROXY parsing', () => {
    it('parses "false" to boolean false', () => {
      setConfig({ apiKeys: 'key1', allowedOrigins: 'https://example.com', trustProxy: 'false' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.trustProxy).toBe(false);
    });

    it('parses "2" to number 2', () => {
      setConfig({ apiKeys: 'key1', allowedOrigins: 'https://example.com', trustProxy: '2' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.trustProxy).toBe(2);
    });

    it('parses "1" to number 1', () => {
      setConfig({ apiKeys: 'key1', allowedOrigins: 'https://example.com', trustProxy: '1' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.trustProxy).toBe(1);
    });

    it('passes through IP/CIDR strings as-is', () => {
      setConfig({ apiKeys: 'key1', allowedOrigins: 'https://example.com', trustProxy: '10.0.0.0/8' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.trustProxy).toBe('10.0.0.0/8');
    });
  });

  describe('API_KEYS parsing', () => {
    it('parses comma-separated keys into KeyStoreEntry array with positional names', () => {
      setConfig({ apiKeys: 'abc123,def456', allowedOrigins: 'https://example.com', trustProxy: '1' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.apiKeys).toEqual([
        { name: 'key-1', key: 'abc123', enabled: true },
        { name: 'key-2', key: 'def456', enabled: true },
      ]);
    });

    it('trims whitespace from keys', () => {
      setConfig({ apiKeys: ' key1 , key2 ', allowedOrigins: 'https://example.com', trustProxy: '1' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.apiKeys[0].key).toBe('key1');
      expect(result.apiKeys[1].key).toBe('key2');
    });
  });

  describe('HEALTH_API_KEY', () => {
    it('parses optional HEALTH_API_KEY into a single KeyStoreEntry', () => {
      setConfig({
        apiKeys: 'key1',
        allowedOrigins: 'https://example.com',
        trustProxy: '1',
        healthApiKey: 'monitor-secret',
      });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.healthApiKey).toEqual({ name: 'health-key', key: 'monitor-secret', enabled: true });
    });

    it('leaves healthApiKey undefined when not configured', () => {
      setConfig({ apiKeys: 'key1', allowedOrigins: 'https://example.com', trustProxy: '1' });
      const result = loadSecurityConfig(makeMockLogger());
      expect(result.healthApiKey).toBeUndefined();
    });
  });

  describe('startup summary log', () => {
    it('logs info with allowedOrigins, trustProxy, and apiKeyCount — never key values', () => {
      const keys = 'secret-abc,secret-def';
      setConfig({ apiKeys: keys, allowedOrigins: 'https://example.com', trustProxy: '1' });
      const logger = makeMockLogger();
      loadSecurityConfig(logger);

      expect(logger.info).toHaveBeenCalledTimes(1);
      const [logObj] = logger.info.mock.calls[0];
      expect(logObj).toHaveProperty('allowedOrigins');
      expect(logObj).toHaveProperty('trustProxy');
      expect(logObj).toHaveProperty('apiKeyCount', 2);

      // Ensure no key values appear in the log
      const logStr = JSON.stringify(logObj);
      expect(logStr).not.toContain('secret-abc');
      expect(logStr).not.toContain('secret-def');
    });
  });
});
