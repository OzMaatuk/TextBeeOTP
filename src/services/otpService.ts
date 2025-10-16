import crypto from 'crypto';

import { IOtpRepository } from '../repositories/otpRepository';
import { ISmsProvider } from '../providers/smsProvider';

export class OtpService {
  private repo: IOtpRepository;
  private provider: ISmsProvider;
  private ttlSeconds: number;
  private length: number;

  constructor(repo: IOtpRepository, provider: ISmsProvider) {
    this.repo = repo;
    this.provider = provider;
    this.ttlSeconds = Number(process.env.OTP_TTL_SECONDS || 300);
    this.length = Number(process.env.OTP_LENGTH || 6);
  }

  private generateCode(): string {
    const bytes = crypto.randomBytes(4).readUInt32BE(0);
    const max = 10 ** this.length;
    const code = (bytes % max).toString().padStart(this.length, '0');
    return code;
  }

  async sendOTP(phone: string): Promise<void> {
    const windowSeconds = Math.ceil((Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000) / 1000));
    const maxAttempts = Number(process.env.RATE_LIMIT_MAX || 5);

    const existing = await this.repo.get(phone);
    let code: string;
    if (existing && !existing.isExpired()) {
      code = existing.code;
      await this.provider.sendSms(phone, `Your verification code is ${code}`);
    } else {
      code = this.generateCode();
      const expiresAt = Date.now() + this.ttlSeconds * 1000;
      await this.repo.save({ phone, code, expiresAt });
      await this.provider.sendSms(phone, `Your verification code is ${code}`);
    }

    // Only increment attempts after successful send
    const attempts = await this.repo.incrementSendAttempts(phone, windowSeconds);
    if (attempts > maxAttempts) {
      const err: any = new Error('rate_limited');
      err.code = 'RATE_LIMITED';
      throw err;
    }
  }

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    const record = await this.repo.get(phone);
    if (!record) return false;
    if (record.isExpired()) return false;
    if (record.code !== code) return false;

    // invalidate
    await this.repo.delete(phone);
    return true;
  }
}
