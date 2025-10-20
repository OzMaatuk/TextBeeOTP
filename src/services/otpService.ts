import crypto from 'crypto';
import { IOtpRepository } from '../repositories/otpRepository';
import { config } from '../utils/config';
import { IOtpProvider, OtpChannel } from '../providers/otpProvider';

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
    const bytes = crypto.randomBytes(4).readUInt32BE(0);
    const max = 10 ** this.length;
    return (bytes % max).toString().padStart(this.length, '0');
  }

  async sendOTP(recipient: string, channel: OtpChannel): Promise<void> {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`Unsupported channel: ${channel}`);
    }

    const windowSeconds = Math.ceil(config.rateLimitWindowMs / 1000);
    const maxAttempts = config.rateLimitMax;

    const existing = await this.repo.get(recipient);
    let code: string;
    const messageTemplate = (c: string) => `Your verification code is ${c}`;

    if (existing && !existing.isExpired()) {
      code = existing.code;
      await provider.sendOtp(recipient, messageTemplate(code));
    } else {
      code = this.generateCode();
      const expiresAt = Date.now() + this.ttlSeconds * 1000;
      await this.repo.save({ recipient, code, expiresAt });
      await provider.sendOtp(recipient, messageTemplate(code));
    }

    // Only increment attempts after successful send
    const attempts = await this.repo.incrementSendAttempts(recipient, windowSeconds);
    if (attempts > maxAttempts) {
      const err: any = new Error('rate_limited');
      err.code = 'RATE_LIMITED';
      throw err;
    }
  }

  async verifyOTP(recipient: string, code: string): Promise<boolean> {
    const record = await this.repo.get(recipient);
    if (!record || record.isExpired() || record.code !== code) {
      return false;
    }

    // invalidate after successful verification
    await this.repo.delete(recipient);
    return true;
  }
}
