import { IOtpProvider } from './otpProvider';

// TODO: Implement a real email provider.
// A mock email provider that logs to the console.
// In a real app, this would use a library like nodemailer.
export class EmailAdapter implements IOtpProvider {
  async sendOtp(recipient: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[EmailAdapter] mock send to ${recipient}:`);
    // eslint-disable-next-line no-console
    console.log(`-----------------------------------------`);
    // eslint-disable-next-line no-console
    console.log(message);
    // eslint-disable-next-line no-console
    console.log(`-----------------------------------------`);
    return Promise.resolve();
  }
}
