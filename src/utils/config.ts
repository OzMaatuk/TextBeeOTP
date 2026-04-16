function validateNumber(value: number, name: string, min?: number, max?: number): number {
  if (Number.isNaN(value)) {
    throw new Error(`Invalid ${name}: ${process.env[name]} is not a valid number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`Invalid ${name}: ${value} is less than minimum ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`Invalid ${name}: ${value} is greater than maximum ${max}`);
  }
  return value;
}

function validateString(value: string | undefined, name: string, options?: { minLength?: number }): string {
  const normalized = value?.trim() ?? '';
  if (options?.minLength && normalized.length < options.minLength) {
    throw new Error(`Invalid ${name}: must be at least ${options.minLength} characters`);
  }
  return normalized;
}

function readOtpSecret(): string {
  const envSecret = validateString(process.env.OTP_SECRET, 'OTP_SECRET');
  if (envSecret) {
    return envSecret;
  }
  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error('OTP_SECRET is required in production');
  }
  return 'local-development-secret-change-me';
}

export const config = {
  get apiPort() {
    const val = Number(process.env.API_PORT || process.env.PORT || process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3008);
    return validateNumber(val, 'API_PORT', 1, 65535);
  },
  get uiPort() {
    const val = Number(process.env.UI_PORT || process.env.X_ZOHO_CATALYST_LISTEN_PORT || 8080);
    return validateNumber(val, 'UI_PORT', 1, 65535);
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  get otpTtlSeconds() {
    const val = Number(process.env.OTP_TTL_SECONDS || 300);
    return validateNumber(val, 'OTP_TTL_SECONDS', 60, 3600);
  },
  get otpLength() {
    const val = Number(process.env.OTP_LENGTH || 6);
    return validateNumber(val, 'OTP_LENGTH', 4, 10);
  },
  get otpSecret() {
    return readOtpSecret();
  },
  get rateLimitWindowMs() {
    const val = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    return validateNumber(val, 'RATE_LIMIT_WINDOW_MS', 1000);
  },
  get rateLimitMax() {
    const val = Number(process.env.RATE_LIMIT_MAX || 5);
    return validateNumber(val, 'RATE_LIMIT_MAX', 1);
  },
  get verifyRateLimitMax() {
    const val = Number(process.env.VERIFY_RATE_LIMIT_MAX || 10);
    return validateNumber(val, 'VERIFY_RATE_LIMIT_MAX', 1);
  },
  get jsonBodyLimit() {
    return validateString(process.env.JSON_BODY_LIMIT, 'JSON_BODY_LIMIT') || '8kb';
  },
  get redisUrl() {
    return validateString(process.env.REDIS_URL, 'REDIS_URL') || undefined;
  },
  get textbeeApiKey() {
    return validateString(process.env.TEXTBEE_API_KEY, 'TEXTBEE_API_KEY');
  },
  get textbeeDeviceId() {
    return validateString(process.env.TEXTBEE_DEVICE_ID, 'TEXTBEE_DEVICE_ID');
  },
  get emailFrom() {
    return validateString(process.env.EMAIL_FROM, 'EMAIL_FROM') || 'noreply@example.com';
  },
  get smtpHost() {
    return validateString(process.env.SMTP_HOST, 'SMTP_HOST') || 'smtp.zoho.com';
  },
  get smtpPort() {
    const val = Number(process.env.SMTP_PORT || 465);
    return validateNumber(val, 'SMTP_PORT', 1, 65535);
  },
  get smtpSecure() {
    const raw = process.env.SMTP_SECURE;
    if (raw === undefined) return true;
    return /^(1|true|yes)$/i.test(raw);
  },
  get smtpUser() {
    return validateString(process.env.SMTP_USER, 'SMTP_USER');
  },
  get smtpPass() {
    return validateString(process.env.SMTP_PASS, 'SMTP_PASS');
  },
  get exposeDocs() {
    return !this.isProduction;
  },
  get oidcServerUrl() {
    return validateString(process.env.OIDC_SERVER_URL, 'OIDC_SERVER_URL') || undefined;
  },
  get oidcClientId() {
    return validateString(process.env.OIDC_CLIENT_ID, 'OIDC_CLIENT_ID') || 'oauth2-proxy';
  },
  get oidcClientSecret() {
    return validateString(process.env.OIDC_CLIENT_SECRET, 'OIDC_CLIENT_SECRET') || undefined;
  },
  get oidcRedirectUris() {
    const raw = process.env.OIDC_REDIRECT_URIS;
    if (!raw) return undefined;
    return raw.split(',').map((uri) => uri.trim());
  },
  get enableOidc() {
    const raw = process.env.ENABLE_OIDC || 'false';
    return /^(1|true|yes)$/i.test(raw);
  },
};
