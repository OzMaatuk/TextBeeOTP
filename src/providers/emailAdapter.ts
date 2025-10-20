import { Resend } from 'resend';
import { IOtpProvider } from './otpProvider';

export class EmailAdapter implements IOtpProvider {
  private resend: Resend | null;
  private fromEmail: string;
  private hasApiKey: boolean;

  constructor(apiKey?: string, fromEmail?: string) {
    this.hasApiKey = !!(apiKey || process.env.RESEND_API_KEY);
    this.resend = this.hasApiKey ? new Resend(apiKey || process.env.RESEND_API_KEY) : null;
    this.fromEmail = fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
  }

  async sendOtp(recipient: string, message: string): Promise<void> {
    // If no API key is provided, fall back to mock mode for development/testing
    if (!this.hasApiKey) {
      console.log(`[EmailAdapter] mock send to ${recipient}:`);
      console.log(`-----------------------------------------`);
      console.log(message);
      console.log(`-----------------------------------------`);
      return Promise.resolve();
    }

    try {
      const { data, error } = await this.resend!.emails.send({
        from: this.fromEmail,
        to: [recipient],
        subject: 'Your Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; color: #007bff;">${message}</span>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 5 minutes. If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
        text: `Your verification code is: ${message}\n\nThis code will expire in 5 minutes. If you didn't request this code, please ignore this email.`
      });

      if (error) {
        console.error('[EmailAdapter] Error sending email:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log('[EmailAdapter] Email sent successfully:', data?.id);
    } catch (error) {
      console.error('[EmailAdapter] Unexpected error:', error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
