export function normalizeRecipient(recipient: string, channel?: 'sms' | 'email'): string {
  const trimmed = recipient.trim();
  if (channel === 'email' || trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/\s+/g, '');
}
