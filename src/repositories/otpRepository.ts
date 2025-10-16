export type OtpRecord = {
  phone: string;
  code: string;
  expiresAt: number;
  createdAt?: number;
  // helper
  isExpired?: () => boolean;
};

export interface IOtpRepository {
  save(record: OtpRecord): Promise<void>;
  get(phone: string): Promise<(OtpRecord & { isExpired: () => boolean }) | null>;
  delete(phone: string): Promise<void>;
  // Per-phone rate limiting helpers
  incrementSendAttempts(phone: string, windowSeconds: number): Promise<number>;
  resetSendAttempts(phone: string): Promise<void>;
}
