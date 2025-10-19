export type OtpRecord = {
  recipient: string;
  code: string;
  expiresAt: number;
  createdAt?: number;
  // helper
  isExpired?: () => boolean;
};

export interface IOtpRepository {
  save(record: OtpRecord): Promise<void>;
  get(recipient: string): Promise<(OtpRecord & { isExpired: () => boolean }) | null>;
  delete(recipient: string): Promise<void>;
  // Per-recipient rate limiting helpers
  incrementSendAttempts(recipient: string, windowSeconds: number): Promise<number>;
  resetSendAttempts(recipient: string): Promise<void>;
}
