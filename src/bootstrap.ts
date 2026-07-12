import { OtpService } from './services/otpService.js';
import { InMemoryOtpRepository } from './repositories/inMemoryOtpRepo.js';
import { RedisOtpRepository } from './repositories/redisOtpRepo.js';
import { EmailAdapter } from './providers/emailAdapter.js';
import { TextBeeAdapter } from './providers/textbeeAdapter.js';
import { IOtpProvider, OtpChannel } from './providers/otpProvider.js';
import { config } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { loadSecurityConfig, SecurityConfig } from './utils/securityConfig.js';

export function createOtpService() {
  const logger = createLogger();

  let securityConfig: SecurityConfig;
  try {
    securityConfig = loadSecurityConfig(logger);
  } catch (err) {
    logger.fatal({ err }, 'Security configuration error');
    process.exit(1);
  }

  if (!config.authTokenSecret) {
    if (config.isProduction) {
      logger.fatal('AUTH_TOKEN_SECRET is required in production');
      process.exit(1);
    } else {
      logger.warn('AUTH_TOKEN_SECRET not set — /ui/otp/verify will fail to sign tokens');
    }
  }

  const repo = config.redisUrl ? new RedisOtpRepository(config.redisUrl, logger) : new InMemoryOtpRepository();

  if (config.redisUrl) {
    let maskedUrl = '[invalid redis url]';
    try {
      const parsed = new URL(config.redisUrl);
      if (parsed.password) {
        parsed.password = '****';
      }
      maskedUrl = parsed.toString();
    } catch {
      // Ignore URL parsing errors
    }
    logger.info({ redisUrl: maskedUrl }, 'Using Redis OTP repository');
  } else {
    logger.warn('REDIS_URL not configured, using in-memory OTP repository');
  }

  const smsAdapter = new TextBeeAdapter(config.textbeeApiKey, config.textbeeDeviceId, undefined, logger);
  const emailAdapter = new EmailAdapter(undefined, config.emailFrom, logger);

  // Validate providers at startup
  if (config.isProduction) {
    // SMS temporarily disabled
    /*
    try {
      smsAdapter.validateCredentials();
    } catch (err) {
      throw new Error(`SMS provider validation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    */
    if (config.enableSmsOtp) {
      try {
        smsAdapter.validateCredentials();
      } catch (err) {
        throw new Error(`SMS provider validation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    try {
      emailAdapter.validateCredentials();
    } catch (err) {
      throw new Error(`Email provider validation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const providers = new Map<OtpChannel, IOtpProvider>();
  // SMS temporarily disabled
  // providers.set('sms', smsAdapter);
  if (config.enableSmsOtp) {
    providers.set('sms', smsAdapter);
  }
  providers.set('email', emailAdapter);

  return {
    logger,
    repo,
    providers,
    otpService: new OtpService(repo, providers),
    securityConfig,
  };
}
