import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function generateAuthToken(recipient: string): string {
  const secret = config.authTokenSecret;
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET is not configured');
  }
  
  const payload = {
    email: recipient,
    sub: recipient, // Subject (unique identifier)
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + config.authTokenTtlSeconds,
  };
  
  return jwt.sign(payload, secret, { expiresIn: config.authTokenTtlSeconds });
}

export function verifyAuthToken(token: string): any {
  const secret = config.authTokenSecret;
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET is not configured');
  }
  
  return jwt.verify(token, secret);
}