import crypto from 'crypto';
import { config } from './config';

export function hashOtp(recipient: string, code: string): string {
  return crypto.createHmac('sha256', config.otpSecret).update(`${recipient}:${code}`).digest('hex');
}

export function timingSafeOtpEqual(expectedHash: string, recipient: string, candidateCode: string): boolean {
  const candidateHash = hashOtp(recipient, candidateCode);
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(candidateHash, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}
