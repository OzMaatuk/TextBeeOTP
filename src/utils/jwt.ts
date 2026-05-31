import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface AuthTokenPayload {
  email: string;
  sub: string;
  exp: number;
  iat: number;
}

export function generateAuthToken(recipient: string): string {
  const secret = config.authTokenSecret;
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET is not configured');
  }

  return jwt.sign(
    { email: recipient, sub: recipient },
    secret,
    { expiresIn: config.authTokenTtlSeconds }
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const secret = config.authTokenSecret;
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET is not configured');
  }

  return jwt.verify(token, secret) as AuthTokenPayload;
}
