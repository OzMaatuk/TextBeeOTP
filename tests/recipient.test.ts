import { normalizeRecipient } from '../src/utils/recipient';

describe('Recipient Validation', () => {
  describe('Email validation', () => {
    it('validates and normalizes valid email addresses', () => {
      expect(normalizeRecipient('Test@Example.com', 'email')).toBe('test@example.com');
      expect(normalizeRecipient('  user@domain.co.uk  ', 'email')).toBe('user@domain.co.uk');
    });

    it('throws on invalid email format', () => {
      expect(() => normalizeRecipient('notanemail', 'email')).toThrow('Invalid email format');
      expect(() => normalizeRecipient('missing@domain', 'email')).toThrow('Invalid email format');
      expect(() => normalizeRecipient('user@', 'email')).toThrow('Invalid email format');
    });

    it('auto-detects email by @ symbol', () => {
      expect(normalizeRecipient('user@example.com')).toBe('user@example.com');
    });
  });

  describe('Phone number validation', () => {
    it('validates valid phone numbers', () => {
      expect(normalizeRecipient('+1234567890', 'sms')).toBe('+1234567890');
      expect(normalizeRecipient('1234567890', 'sms')).toBe('1234567890');
      expect(normalizeRecipient('+1 234 567 890', 'sms')).toBe('+1234567890');
      expect(normalizeRecipient('(123) 456-7890', 'sms')).toBe('1234567890');
    });

    it('throws on phone numbers too short', () => {
      expect(() => normalizeRecipient('123456', 'sms')).toThrow(
        'Invalid phone number: must be between 10 and 15 digits'
      );
    });

    it('throws on phone numbers too long', () => {
      expect(() => normalizeRecipient('1234567890123456', 'sms')).toThrow(
        'Invalid phone number: must be between 10 and 15 digits'
      );
    });

    it('preserves + prefix in output', () => {
      expect(normalizeRecipient('+1234567890')).toBe('+1234567890');
      expect(normalizeRecipient('+1-234-567-890')).toBe('+1234567890');
    });

    it('removes non-digits except + prefix', () => {
      expect(normalizeRecipient('+1 (234) 567-890')).toBe('+1234567890');
      expect(normalizeRecipient('1 (234) 567-890')).toBe('1234567890');
    });
  });

  describe('Edge cases', () => {
    it('handles whitespace correctly', () => {
      expect(normalizeRecipient('  +1234567890  ')).toBe('+1234567890');
      expect(normalizeRecipient('  test@example.com  ', 'email')).toBe('test@example.com');
    });

    it('handles empty string', () => {
      expect(() => normalizeRecipient('', 'sms')).toThrow();
      expect(() => normalizeRecipient('', 'email')).toThrow();
    });
  });
});
