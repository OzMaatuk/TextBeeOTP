import { IOtpRepository, OtpRecord } from './otpRepository';
import Redis from 'ioredis';
import { InMemoryOtpRepository } from './inMemoryOtpRepo';

const ATTEMPT_PREFIX = 'otp:attempts:';
const RECORD_PREFIX = 'otp:record:';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const CONNECTION_TIMEOUT_MS = 10000;

export class RedisOtpRepository implements IOtpRepository {
  private client: Redis; // The type remains Redis, as ioredis-mock is compatible
  private fallback: InMemoryOtpRepository;
  private healthy: boolean;
  private retryCount: number;
  private redisDisabled: boolean;

  // MODIFICATION: Accept an optional client in the constructor
  constructor(client?: Redis);
  constructor(redisUrl?: string);
  constructor(clientOrUrl?: Redis | string) {
    if (typeof clientOrUrl === 'object') {
      this.client = clientOrUrl;
      // If using a mock client, assume it's healthy
      this.healthy = true;
      this.redisDisabled = false;
      this.retryCount = 0;
    } else {
      const redisUrl = clientOrUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      const self = this; // Capture reference for use in retryStrategy
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > MAX_RETRY_ATTEMPTS) {
            // After max retries, stop trying and use fallback
            self.redisDisabled = true;
            self.healthy = false;
            // eslint-disable-next-line no-console
            console.warn(`[RedisOtpRepository] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Disabling Redis and using in-memory storage.`);
            return null; // Stop retrying
          }
          // Exponential backoff: 1s, 2s, 4s (capped at 10s)
          const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, times - 1), 10000);
          // eslint-disable-next-line no-console
          console.log(`[RedisOtpRepository] Retrying Redis connection (attempt ${times}/${MAX_RETRY_ATTEMPTS}) in ${delay}ms...`);
          return delay;
        },
        connectTimeout: CONNECTION_TIMEOUT_MS,
        enableOfflineQueue: false, // Don't queue commands when offline
        reconnectOnError: (err: Error) => {
          // Only reconnect on specific errors (not all errors)
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
        enableReadyCheck: true,
      });

      this.healthy = false;
      this.redisDisabled = false;
      this.retryCount = 0;
    }

    this.fallback = new InMemoryOtpRepository();

    this.client.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[RedisOtpRepository] Redis error:', err.message);
      this.healthy = false;
    });

    this.client.on('ready', () => {
      if (!this.redisDisabled) {
        // eslint-disable-next-line no-console
        console.log('[RedisOtpRepository] Connected to Redis successfully');
        this.healthy = true;
        this.retryCount = 0;
      }
    });

    this.client.on('close', () => {
      if (!this.redisDisabled) {
        this.healthy = false;
      }
    });

    // Monitor connection status
    if (typeof clientOrUrl !== 'object') {
      // Wait for initial connection attempt with timeout
      this.attemptInitialConnection();
    }
  }

  private async attemptInitialConnection(): Promise<void> {
    // Use a promise that resolves when connected or times out
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.retryCount++;
        if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
          this.redisDisabled = true;
          this.healthy = false;
          // eslint-disable-next-line no-console
          console.warn(
            `[RedisOtpRepository] Failed to connect to Redis after ${MAX_RETRY_ATTEMPTS} attempts. Using in-memory storage.`
          );
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `[RedisOtpRepository] Initial Redis connection timeout (attempt ${this.retryCount}/${MAX_RETRY_ATTEMPTS}). Will use in-memory storage.`
          );
        }
        reject(new Error('Connection timeout'));
      }, CONNECTION_TIMEOUT_MS);

      // Check if already connected
      if (this.client.status === 'ready') {
        clearTimeout(timeout);
        this.healthy = true;
        resolve();
        return;
      }

      // Wait for ready event
      const onReady = () => {
        clearTimeout(timeout);
        this.client.removeListener('error', onError);
        this.healthy = true;
        this.retryCount = 0;
        resolve();
      };

      const onError = (err: Error) => {
        clearTimeout(timeout);
        this.client.removeListener('ready', onReady);
        this.healthy = false;
        reject(err);
      };

      this.client.once('ready', onReady);
      this.client.once('error', onError);
    });

    try {
      await connectionPromise;
      // Connection successful - will be logged in 'ready' event handler
    } catch (err) {
      // Connection failed - handled in promise
      if (!this.redisDisabled) {
        this.healthy = false;
      }
    }
  }

  // ... rest of the file is unchanged ...
  private recordKey(recipient: string) {
    return `${RECORD_PREFIX}${recipient}`;
  }

  private attemptKey(recipient: string) {
    return `${ATTEMPT_PREFIX}${recipient}`;
  }

  async save(record: OtpRecord): Promise<void> {
    if (this.redisDisabled || !this.healthy) return this.fallback.save(record);
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
    if (this.redisDisabled || !this.healthy) return this.fallback.get(recipient);
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
    if (this.redisDisabled || !this.healthy) return this.fallback.delete(recipient);
    try {
      const key = this.recordKey(recipient);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.delete(recipient);
    }
  }

  async incrementSendAttempts(recipient: string, windowSeconds: number): Promise<number> {
    if (this.redisDisabled || !this.healthy) return this.fallback.incrementSendAttempts(recipient, windowSeconds);
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
    if (this.redisDisabled || !this.healthy) return this.fallback.resetSendAttempts(recipient);
    try {
      const key = this.attemptKey(recipient);
      await this.client.del(key);
    } catch (err) {
      this.healthy = false;
      return this.fallback.resetSendAttempts(recipient);
    }
  }
}
