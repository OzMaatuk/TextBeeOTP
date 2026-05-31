import jwt from 'jsonwebtoken';
import { generateAuthToken, verifyAuthToken, AuthTokenPayload } from '../src/utils/jwt';

const SECRET = 'test-secret-value';
const RECIPIENT = 'user@example.com';

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = SECRET;
  process.env.AUTH_TOKEN_TTL_SECONDS = '300';
});

afterEach(() => {
  delete process.env.AUTH_TOKEN_SECRET;
  delete process.env.AUTH_TOKEN_TTL_SECONDS;
});

describe('generateAuthToken', () => {
  it('returns a signed JWT containing email and sub', () => {
    const token = generateAuthToken(RECIPIENT);
    const decoded = jwt.verify(token, SECRET) as AuthTokenPayload;

    expect(decoded.email).toBe(RECIPIENT);
    expect(decoded.sub).toBe(RECIPIENT);
  });

  it('sets exp roughly equal to now + TTL', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateAuthToken(RECIPIENT);
    const after = Math.floor(Date.now() / 1000);

    const decoded = jwt.decode(token) as AuthTokenPayload;
    expect(decoded.exp).toBeGreaterThanOrEqual(before + 300);
    expect(decoded.exp).toBeLessThanOrEqual(after + 300);
  });

  it('does not set exp twice (no duplicate claim)', () => {
    const token = generateAuthToken(RECIPIENT);
    // Decode raw payload — if exp was set twice jsonwebtoken would reject it
    const decoded = jwt.decode(token) as Record<string, unknown>;
    // Only one exp key should exist (JS objects can't have duplicate keys anyway,
    // but this confirms the payload structure is clean)
    expect(typeof decoded.exp).toBe('number');
  });

  it('throws when AUTH_TOKEN_SECRET is missing', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    expect(() => generateAuthToken(RECIPIENT)).toThrow('AUTH_TOKEN_SECRET is not configured');
  });
});

describe('verifyAuthToken', () => {
  it('verifies a valid token and returns the payload', () => {
    const token = generateAuthToken(RECIPIENT);
    const payload = verifyAuthToken(token);

    expect(payload.email).toBe(RECIPIENT);
    expect(payload.sub).toBe(RECIPIENT);
    expect(typeof payload.exp).toBe('number');
    expect(typeof payload.iat).toBe('number');
  });

  it('throws on a tampered token', () => {
    const token = generateAuthToken(RECIPIENT) + 'tampered';
    expect(() => verifyAuthToken(token)).toThrow();
  });

  it('throws on a token signed with a different secret', () => {
    const otherToken = jwt.sign({ email: RECIPIENT, sub: RECIPIENT }, 'wrong-secret', { expiresIn: 300 });
    expect(() => verifyAuthToken(otherToken)).toThrow();
  });

  it('throws on an expired token', () => {
    const expired = jwt.sign({ email: RECIPIENT, sub: RECIPIENT }, SECRET, { expiresIn: -1 });
    expect(() => verifyAuthToken(expired)).toThrow();
  });

  it('throws when AUTH_TOKEN_SECRET is missing', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    const token = jwt.sign({ email: RECIPIENT }, SECRET, { expiresIn: 300 });
    expect(() => verifyAuthToken(token)).toThrow('AUTH_TOKEN_SECRET is not configured');
  });
});
