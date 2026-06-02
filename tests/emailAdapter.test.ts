import { EmailAdapter } from '../src/providers/emailAdapter';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailAdapter', () => {
  let mockTransport: { sendMail: jest.Mock<Promise<{ messageId: string }>, [unknown]> };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransport = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '<test@example.com>' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransport);
  });

  describe('Constructor', () => {
    it('creates transport in SMTP mode when credentials provided', () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';

      new EmailAdapter(undefined, 'test@example.com');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          auth: {
            user: 'user@example.com',
            pass: 'password123',
          },
        })
      );
    });

    it('uses provided fromEmail', () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';

      const adapter = new EmailAdapter(undefined, 'custom@example.com');
      adapter.sendOtp('recipient@example.com', 'Your code is 123456');

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        })
      );
    });
  });

  describe('validateCredentials', () => {
    it('throws when SMTP credentials are not configured', () => {
      // Clear env vars
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const adapter = new EmailAdapter();

      expect(() => adapter.validateCredentials()).toThrow(
        'Email credentials missing: SMTP_USER and SMTP_PASS are required for email delivery'
      );
    });

    it('does not throw when credentials are configured', () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';

      const adapter = new EmailAdapter();

      expect(() => adapter.validateCredentials()).not.toThrow();
    });
  });

  describe('sendOtp', () => {
    beforeEach(() => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
    });

    it('sends email with correct content', async () => {
      const adapter = new EmailAdapter(undefined, 'noreply@example.com');

      await adapter.sendOtp('recipient@example.com', '123456');

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'recipient@example.com',
          subject: 'Your Verification Code',
        })
      );
    });

    it('includes verification code in email body', async () => {
      const adapter = new EmailAdapter(undefined, 'noreply@example.com');

      await adapter.sendOtp('recipient@example.com', '654321');

      const call = mockTransport.sendMail.mock.calls[0][0] as { text: string; html: string };
      expect(call.text).toContain('654321');
      expect(call.html).toContain('654321');
    });

    it('escapes HTML in message', async () => {
      const adapter = new EmailAdapter(undefined, 'noreply@example.com');

      await adapter.sendOtp('recipient@example.com', '<script>alert("xss")</script>');

      const call = mockTransport.sendMail.mock.calls[0][0] as { text: string; html: string };
      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });

    it('includes expiration info in email', async () => {
      const adapter = new EmailAdapter(undefined, 'noreply@example.com');

      await adapter.sendOtp('recipient@example.com', '123456');

      const call = mockTransport.sendMail.mock.calls[0][0] as { text: string; html: string };
      expect(call.text).toContain('5 minute');
      expect(call.html).toContain('5 minute');
    });

    it('throws when sendMail fails', async () => {
      mockTransport.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const adapter = new EmailAdapter(undefined, 'noreply@example.com');

      await expect(adapter.sendOtp('recipient@example.com', '123456')).rejects.toThrow(
        'Email sending failed: SMTP connection failed'
      );
    });

    it('returns successfully in mock mode', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const adapter = new EmailAdapter();

      await expect(adapter.sendOtp('recipient@example.com', '123456')).resolves.toBeUndefined();
      expect(mockTransport.sendMail).not.toHaveBeenCalled();
    });
  });
});
