import { OtpService } from '../src/services/otpService';
import { InMemoryOtpRepository } from '../src/repositories/inMemoryOtpRepo';
import { ISmsProvider } from '../src/providers/smsProvider';

class MockProvider implements ISmsProvider {
  public last: { recipient?: string; message?: string } = {};
  async sendSms(recipient: string, message: string): Promise<void> {
    this.last = { recipient, message };
  }
}

describe('OtpService', () => {
  it('generates and verifies OTP', async () => {
    const repo = new InMemoryOtpRepository();
    const prov = new MockProvider();
    const svc = new OtpService(repo, prov as ISmsProvider);

    await svc.sendOTP('+1234567890');
    const record = await repo.get('+1234567890');
    expect(record).not.toBeNull();
    if (record) {
      expect(record.code).toHaveLength(Number(process.env.OTP_LENGTH || 6));
    }

    // wrong code
    let ok = await svc.verifyOTP('+1234567890', '000000');
    expect(ok).toBe(false);

    // correct code
    if (record) {
      ok = await svc.verifyOTP('+1234567890', record.code);
      expect(ok).toBe(true);
    }
  });
});
