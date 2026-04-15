import crypto from 'crypto';
import { IOtpRepository } from '../repositories/otpRepository.js';
import { config } from '../utils/config.js';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider.js';
import { hashOtp, timingSafeOtpEqual } from '../utils/otpCrypto.js';
import { normalizeRecipient } from '../utils/recipient.js';

type RateLimitedError = Error & { code: 'RATE_LIMITED' };

export class OtpService {
  private repo: IOtpRepository;
  private providers: Map<OtpChannel, IOtpProvider>;
  private ttlSeconds: number;
  private length: number;

  constructor(repo: IOtpRepository, providers: Map<OtpChannel, IOtpProvider>) {
    this.repo = repo;
    this.providers = providers;
    this.ttlSeconds = config.otpTtlSeconds;
    this.length = config.otpLength;
  }

  private generateCode(): string {
    const max = 10 ** this.length;
    // Use rejection sampling to eliminate modulo bias
    // Find the largest multiple of max that fits in 32 bits
    const maxSafe = Math.floor(2 ** 32 / max) * max;
    let bytes: number;
    do {
      bytes = crypto.randomBytes(4).readUInt32BE(0);
    } while (bytes >= maxSafe);
    return (bytes % max).toString().padStart(this.length, '0');
  }

  async sendOTP(recipient: string, channel: OtpChannel): Promise<void> {
    const normalizedRecipient = normalizeRecipient(recipient, channel);
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`Unsupported channel: ${channel}`);
    }

    const windowSeconds = Math.ceil(config.rateLimitWindowMs / 1000);
    const maxAttempts = config.rateLimitMax;

    // Check rate limit BEFORE sending to prevent wasted SMS/email
    const attempts = await this.repo.incrementSendAttempts(normalizedRecipient, windowSeconds);
    if (attempts > maxAttempts) {
      const err: RateLimitedError = Object.assign(new Error('rate_limited'), {
        code: 'RATE_LIMITED' as const,
      });
      err.code = 'RATE_LIMITED';
      throw err;
    }

    const messageTemplate = (c: string) => `Your verification code is ${c}`;
    const code = this.generateCode();
    const expiresAt = Date.now() + this.ttlSeconds * 1000;

    await provider.sendOtp(normalizedRecipient, messageTemplate(code));
    await this.repo.save({
      recipient: normalizedRecipient,
      code: hashOtp(normalizedRecipient, code),
      expiresAt,
    });
  }

  async verifyOTP(recipient: string, code: string): Promise<boolean> {
    const normalizedRecipient = normalizeRecipient(recipient);
    const record = await this.repo.get(normalizedRecipient);
    if (!record || record.isExpired() || !timingSafeOtpEqual(record.code, normalizedRecipient, code)) {
      return false;
    }

    // invalidate after successful verification
    await this.repo.delete(normalizedRecipient);
    await this.repo.resetSendAttempts(normalizedRecipient);
    return true;
  }
}
