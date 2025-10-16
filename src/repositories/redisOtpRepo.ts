import { IOtpRepository, OtpRecord } from './otpRepository';
import Redis from 'ioredis';
import { InMemoryOtpRepository } from './inMemoryOtpRepo';

const ATTEMPT_PREFIX = 'otp:attempts:';
const RECORD_PREFIX = 'otp:record:';

export class RedisOtpRepository implements IOtpRepository {
  private client: Redis;
  private fallback: InMemoryOtpRepository;
  private healthy: boolean;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    this.fallback = new InMemoryOtpRepository();
    this.healthy = true;
    this.client.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[RedisOtpRepository] Failed to connect to Redis:', err.message);
      console.warn('[RedisOtpRepository] Falling back to in-memory storage');
      // eslint-disable-next-line no-console
      console.error('[RedisOtpRepository] Redis error:', err);
      this.healthy = false;
    });
    this.client.on('ready', () => {
      this.healthy = true;
    });
  }

  private recordKey(phone: string) {
    return `${RECORD_PREFIX}${phone}`;
  }

  private attemptKey(phone: string) {
    return `${ATTEMPT_PREFIX}${phone}`;
  }

  async save(record: OtpRecord): Promise<void> {
    if (!this.healthy) return this.fallback.save(record);
    try {
      const key = this.recordKey(record.phone);
      await this.client.hmset(key, {
        code: record.code,
        expiresAt: String(record.expiresAt),
        createdAt: String(record.createdAt || Date.now()),
      });
      const ttl = Math.ceil((record.expiresAt - Date.now()) / 1000) + 60;
      await this.client.expire(key, ttl);
    } catch (err) {
      this.healthy = false;
      return this.fallback.save(record);
    }
  }

  async get(phone: string): Promise<(OtpRecord & { isExpired: () => boolean }) | null> {
    if (!this.healthy) return this.fallback.get(phone);
    try {
      const key = this.recordKey(phone);
      const data = await this.client.hgetall(key);
      if (!data || !data.code) return null;
      const rec: OtpRecord = {
        phone,
        code: data.code,
        expiresAt: Number(data.expiresAt),
        createdAt: Number(data.createdAt),
      };
      const isExpired = () => Date.now() > rec.expiresAt;
      return { ...rec, isExpired };
    } catch (err) {
      this.healthy = false;
      return this.fallback.get(phone);
    }
  }

  async delete(phone: string): Promise<void> {
    if (!this.healthy) return this.fallback.delete(phone);
    try {
      const key = this.recordKey(phone);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.delete(phone);
    }
  }

  async incrementSendAttempts(phone: string, windowSeconds: number): Promise<number> {
    if (!this.healthy) return this.fallback.incrementSendAttempts(phone, windowSeconds);
    try {
      const key = this.attemptKey(phone);
      const tx = this.client.multi();
      tx.incr(key);
      tx.expire(key, windowSeconds);
      const res = await tx.exec();
      if (!res) return 0;
      const count = Number(res[0][1]);
      return count;
    } catch (err) {
      this.healthy = false;
      return this.fallback.incrementSendAttempts(phone, windowSeconds);
    }
  }

  async resetSendAttempts(phone: string): Promise<void> {
    if (!this.healthy) return this.fallback.resetSendAttempts(phone);
    try {
      const key = this.attemptKey(phone);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.resetSendAttempts(phone);
    }
  }
}
