import { IOtpProvider } from './otpProvider';
import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../utils/config';

export class EmailAdapter implements IOtpProvider {
  private transporter: Transporter | null;
  private fromEmail: string;
  private mode: 'smtp' | 'mock';

  constructor(_unusedApiKey?: string, fromEmail?: string) {
    this.fromEmail = fromEmail || config.emailFrom;
    if (config.smtpUser && config.smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });
      this.mode = 'smtp';
    } else {
      this.transporter = null;
      this.mode = 'mock';
    }
  }

  async sendOtp(recipient: string, message: string): Promise<void> {
    // Mock mode for development/testing when no provider configured
    if (this.mode === 'mock') {
      console.log(`[EmailAdapter] mock send to ${recipient}:`);
      console.log(`-----------------------------------------`);
      console.log(message);
      console.log(`-----------------------------------------`);
      return Promise.resolve();
    }

    try {
      const subject = 'Your Verification Code';
      const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; color: #007bff;">${message}</span>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 5 minutes. If you didn't request this code, please ignore this email.
            </p>
          </div>`;
      const text = `Your verification code is: ${message}\n\nThis code will expire in 5 minutes. If you didn't request this code, please ignore this email.`;

      if (this.mode === 'smtp' && this.transporter) {
        const info = await this.transporter.sendMail({
          from: this.fromEmail,
          to: recipient,
          subject,
          html,
          text,
        });
        console.log('[EmailAdapter] Email sent via SMTP:', info.messageId);
      } else {
        throw new Error('Email provider is not properly configured');
      }
    } catch (error) {
      console.error('[EmailAdapter] Unexpected error:', error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
