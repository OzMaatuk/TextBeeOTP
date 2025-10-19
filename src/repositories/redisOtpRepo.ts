import { IOtpRepository, OtpRecord } from './otpRepository';
import Redis from 'ioredis';
import { InMemoryOtpRepository } from './inMemoryOtpRepo';

const ATTEMPT_PREFIX = 'otp:attempts:';
const RECORD_PREFIX = 'otp:record:';

export class RedisOtpRepository implements IOtpRepository {
  private client: Redis; // The type remains Redis, as ioredis-mock is compatible
  private fallback: InMemoryOtpRepository;
  private healthy: boolean;

  // MODIFICATION: Accept an optional client in the constructor
  constructor(client?: Redis);
  constructor(redisUrl?: string);
  constructor(clientOrUrl?: Redis | string) {
    if (typeof clientOrUrl === 'object') {
      this.client = clientOrUrl;
    } else {
      this.client = new Redis(clientOrUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    }

    this.fallback = new InMemoryOtpRepository();
    this.healthy = true;

    this.client.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[RedisOtpRepository] Failed to connect to Redis:', err.message);
      console.warn('[RedisOtpRepository] Falling back to in-memory storage');
      this.healthy = false;
    });

    this.client.on('ready', () => {
      this.healthy = true;
    });
  }

  // ... rest of the file is unchanged ...
  private recordKey(recipient: string) {
    return `${RECORD_PREFIX}${recipient}`;
  }

  private attemptKey(recipient: string) {
    return `${ATTEMPT_PREFIX}${recipient}`;
  }

  async save(record: OtpRecord): Promise<void> {
    if (!this.healthy) return this.fallback.save(record);
    try {
      const key = this.recordKey(record.recipient);
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

  async get(recipient: string): Promise<(OtpRecord & { isExpired: () => boolean }) | null> {
    if (!this.healthy) return this.fallback.get(recipient);
    try {
      const key = this.recordKey(recipient);
      const data = await this.client.hgetall(key);
      if (!data || !data.code) return null;
      const rec: OtpRecord = {
        recipient,
        code: data.code,
        expiresAt: Number(data.expiresAt),
        createdAt: Number(data.createdAt),
      };
      const isExpired = () => Date.now() > rec.expiresAt;
      return { ...rec, isExpired };
    } catch (err) {
      this.healthy = false;
      return this.fallback.get(recipient);
    }
  }

  async delete(recipient: string): Promise<void> {
    if (!this.healthy) return this.fallback.delete(recipient);
    try {
      const key = this.recordKey(recipient);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.delete(recipient);
    }
  }

  async incrementSendAttempts(recipient: string, windowSeconds: number): Promise<number> {
    if (!this.healthy) return this.fallback.incrementSendAttempts(recipient, windowSeconds);
    try {
      const key = this.attemptKey(recipient);
      const tx = this.client.multi();
      tx.incr(key);
      tx.expire(key, windowSeconds);
      const res = await tx.exec();
      if (!res) return 0;
      const count = Number(res[0][1]);
      return count;
    } catch (err) {
      this.healthy = false;
      return this.fallback.incrementSendAttempts(recipient, windowSeconds);
    }
  }

  async resetSendAttempts(recipient: string): Promise<void> {
    if (!this.healthy) return this.fallback.resetSendAttempts(recipient);
    try {
      const key = this.attemptKey(recipient);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.resetSendAttempts(recipient);
    }
  }
}
