import { IOtpRepository, OtpRecord } from './otpRepository';

type InternalRecord = OtpRecord & { createdAt: number };

export class InMemoryOtpRepository implements IOtpRepository {
  private store: Map<string, InternalRecord> = new Map();
  private attempts: Map<string, { count: number; expiresAt: number }> = new Map();

  async save(record: OtpRecord): Promise<void> {
    const createdAt = Date.now();
    this.store.set(record.phone, { ...record, createdAt });
  }

  async get(phone: string): Promise<(OtpRecord & { isExpired: () => boolean }) | null> {
    const rec = this.store.get(phone);
    if (!rec) return null;
    const isExpired = () => Date.now() > rec.expiresAt;
    return { ...rec, isExpired };
  }

  async delete(phone: string): Promise<void> {
    this.store.delete(phone);
  }

  async incrementSendAttempts(phone: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.attempts.get(phone);
    if (!existing || existing.expiresAt < now) {
      this.attempts.set(phone, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    existing.count += 1;
    this.attempts.set(phone, existing);
    return existing.count;
  }

  async resetSendAttempts(phone: string): Promise<void> {
    this.attempts.delete(phone);
  }
}
