import { OtpService } from '../src/services/otpService';
import { InMemoryOtpRepository } from '../src/repositories/inMemoryOtpRepo';
import { IOtpProvider, OtpChannel } from '../src/providers/otpProvider';

// A mock provider that implements the new generic interface
class MockProvider implements IOtpProvider {
  public last: { recipient?: string; message?: string } = {};
  public callCount = 0;

  async sendOtp(recipient: string, message: string): Promise<void> {
    this.last = { recipient, message };
    this.callCount++;
  }

  reset() {
    this.last = {};
    this.callCount = 0;
  }
}

describe('OtpService', () => {
  let repo: InMemoryOtpRepository;
  let smsProvider: MockProvider;
  let emailProvider: MockProvider;
  let svc: OtpService;

  beforeEach(() => {
    // Setup fresh instances for each test
    repo = new InMemoryOtpRepository();
    smsProvider = new MockProvider();
    emailProvider = new MockProvider();

    const providers = new Map<OtpChannel, IOtpProvider>([
      ['sms', smsProvider],
      ['email', emailProvider],
    ]);

    svc = new OtpService(repo, providers);
    process.env.OTP_LENGTH = '6';
  });

  it('sends OTP via SMS and verifies correctly', async () => {
    const recipient = '+1234567890';
    await svc.sendOTP(recipient, 'sms');

    // Check if the correct provider was called
    expect(smsProvider.callCount).toBe(1);
    expect(smsProvider.last.recipient).toBe(recipient);
    expect(emailProvider.callCount).toBe(0); // Ensure email provider was not called

    // Check if the record was saved
    const record = await repo.get(recipient);
    expect(record).not.toBeNull();
    expect(record?.code).toHaveLength(6);

    // Verify wrong code fails
    let ok = await svc.verifyOTP(recipient, '000000');
    expect(ok).toBe(false);

    // Verify correct code succeeds
    if (record) {
      ok = await svc.verifyOTP(recipient, record.code);
      expect(ok).toBe(true);
    }
  });

  it('sends OTP via email and verifies correctly', async () => {
    const recipient = 'test@example.com';
    await svc.sendOTP(recipient, 'email');

    // Check if the correct provider was called
    expect(emailProvider.callCount).toBe(1);
    expect(emailProvider.last.recipient).toBe(recipient);
    expect(smsProvider.callCount).toBe(0);

    const record = await repo.get(recipient);
    expect(record).not.toBeNull();

    if (record) {
      const ok = await svc.verifyOTP(recipient, record.code);
      expect(ok).toBe(true);
    }
  });

  it('throws an error for an unsupported channel', async () => {
    const recipient = 'anybody';
    // Cast to `any` to bypass TypeScript's enum check for testing purposes
    const unsupportedChannel = 'whatsapp' as any;
    await expect(svc.sendOTP(recipient, unsupportedChannel)).rejects.toThrow(
      'Unsupported channel: whatsapp'
    );
  });

  it('deletes the record after successful verification', async () => {
    const recipient = '+1234567890';
    await svc.sendOTP(recipient, 'sms');

    const record = await repo.get(recipient);
    expect(record).not.toBeNull();

    if (record) {
      const ok = await svc.verifyOTP(recipient, record.code);
      expect(ok).toBe(true);
    }

    // After verification, the record should be gone
    const recordAfterVerify = await repo.get(recipient);
    expect(recordAfterVerify).toBeNull();
  });
});
