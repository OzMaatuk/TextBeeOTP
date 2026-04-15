import { OtpService } from './services/otpService';
import { InMemoryOtpRepository } from './repositories/inMemoryOtpRepo';
import { RedisOtpRepository } from './repositories/redisOtpRepo';
import { EmailAdapter } from './providers/emailAdapter';
import { TextBeeAdapter } from './providers/textbeeAdapter';
import { IOtpProvider, OtpChannel } from './providers/otpProvider';
import { config } from './utils/config';
import { createLogger } from './utils/logger';

export function createOtpService() {
  const logger = createLogger();
  const repo = config.redisUrl ? new RedisOtpRepository(config.redisUrl, logger) : new InMemoryOtpRepository();

  if (config.redisUrl) {
    logger.info({ redisUrl: config.redisUrl.replace(/:[^:@]+@/, ':****@') }, 'Using Redis OTP repository');
  } else {
    logger.warn('REDIS_URL not configured, using in-memory OTP repository');
  }

  const smsAdapter = new TextBeeAdapter(config.textbeeApiKey, config.textbeeDeviceId, undefined, logger);
  const emailAdapter = new EmailAdapter(undefined, config.emailFrom, logger);

  // Validate providers at startup
  if (config.isProduction) {
    try {
      smsAdapter.validateCredentials();
    } catch (err) {
      throw new Error(`SMS provider validation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      emailAdapter.validateCredentials();
    } catch (err) {
      throw new Error(`Email provider validation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const providers = new Map<OtpChannel, IOtpProvider>();
  providers.set('sms', smsAdapter);
  providers.set('email', emailAdapter);

  return {
    logger,
    repo,
    providers,
    otpService: new OtpService(repo, providers),
  };
}
