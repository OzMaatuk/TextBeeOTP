export function normalizeRecipient(recipient: string, channel?: 'sms' | 'email'): string {
  const trimmed = recipient.trim();
  if (channel === 'email' || trimmed.includes('@')) {
    // Email validation: basic RFC 5322 check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid email format');
    }
    return trimmed.toLowerCase();
  }

  // Phone number validation: E.164 format or at least looks like a phone
  // Allow formats like: +1234567890, 1234567890 (after normalization)
  const phoneDigits = trimmed.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw new Error('Invalid phone number: must be between 10 and 15 digits');
  }

  // Return normalized phone (digits only or with + prefix)
  if (trimmed.startsWith('+')) {
    return '+' + phoneDigits;
  }
  return phoneDigits;
}
