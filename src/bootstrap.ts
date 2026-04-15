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

  const providers = new Map<OtpChannel, IOtpProvider>();
  providers.set('sms', new TextBeeAdapter(config.textbeeApiKey, config.textbeeDeviceId, undefined, logger));
  providers.set('email', new EmailAdapter(undefined, config.emailFrom, logger));

  return {
    logger,
    repo,
    otpService: new OtpService(repo, providers),
  };
}
