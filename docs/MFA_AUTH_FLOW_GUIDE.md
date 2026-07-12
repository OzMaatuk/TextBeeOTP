# Centralized MFA Auth Flow with OTP

This guide is a short, code-based walkthrough of the OTP authentication flow in this app. It focuses on the actual implementation in the service, routes, and security helpers.

## 1. What the app does

The app implements a simple MFA flow:

1. Receive a recipient and channel.
2. Generate a one-time code.
3. Deliver it by SMS or email.
4. Verify the code.
5. Issue a short-lived JWT token.

The important security idea is that the OTP is never stored in plaintext.

## 2. Send flow

The browser or a backend service calls the send endpoint.

Example endpoint:

- POST /otp/send
- POST /ui/otp/send

Example from the route layer:

```ts
await otpService.sendOTP(recipient, channel as OtpChannel);
return res.status(200).json({ status: 'sent' });
```

Inside the service, the code is generated and then hashed before storage:

```ts
const code = this.generateCode();
const expiresAt = Date.now() + this.ttlSeconds * 1000;

await provider.sendOtp(normalizedRecipient, messageTemplate(code));
await this.repo.save({
  recipient: normalizedRecipient,
  code: hashOtp(normalizedRecipient, code),
  expiresAt,
});
```

Why this is secure:

- The app uses a cryptographically secure random generator.
- The OTP is hashed before it is stored.
- The code expires after a short TTL.

## 3. Verify flow

After the user receives the code, the app verifies it.

Example endpoint:

- POST /otp/verify
- POST /ui/otp/verify

Example from the service:

```ts
const record = await this.repo.get(normalizedRecipient);
if (!record || record.isExpired() || !timingSafeOtpEqual(record.code, normalizedRecipient, code)) {
  return false;
}

await this.repo.delete(normalizedRecipient);
await this.repo.resetSendAttempts(normalizedRecipient);
return true;
```

The comparison uses a timing-safe check:

```ts
export function timingSafeOtpEqual(expectedHash: string, recipient: string, candidateCode: string): boolean {
  const candidateHash = hashOtp(recipient, candidateCode);
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(candidateHash, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}
```

This matters because normal string comparison can leak information through timing.

## 4. Token issuance after successful verification

Once the OTP is validated, the app issues a JWT.

Example:

```ts
export function generateAuthToken(recipient: string): string {
  return jwt.sign({ email: recipient, sub: recipient }, secret, {
    expiresIn: config.authTokenTtlSeconds,
  });
}
```

That token is then returned to the client and can be used for later authenticated requests.

## 5. Rate limiting and abuse prevention

The app applies rate limits before sending and verifying codes.

Examples:

- Send limit: max attempts per recipient window
- Verify limit: max attempts per IP window

This prevents SMS/email flooding and OTP brute-force attempts.

## 6. API authentication for service-to-service calls

Internal services can call the OTP endpoints with an API key.

Example from the middleware:

```ts
const submittedKey = req.headers['x-api-key'];
const matched = findMatchingKey(submittedKey, candidateKeys);

if (!matched) {
  res.status(401).json({ error: 'unauthorized' });
  return;
}
```

The comparison is done with a constant-time function to reduce timing side-channel risk.

## 7. How this fits with Caddy and PocketBase

In a gateway setup, the OTP service is the authentication backend.

The simplified flow is:

1. User hits a protected route.
2. Caddy/PocketBase checks whether the user is already authenticated.
3. If not, the user is sent to the login/verification flow.
4. The OTP service sends and verifies the code.
5. A JWT or session is issued so the user can continue.

So the OTP service provides the proof-of-identity step, while the gateway and PocketBase handle the broader access-control layer.

## 8. Security summary

The main protections in this implementation are:

- OTPs are hashed before storage.
- Verification uses a timing-safe comparison.
- Codes expire automatically.
- The OTP is invalidated after first successful use.
- Rate limits reduce abuse.
- JWTs are short-lived.
- Service calls are protected by API keys.

## Quick reference

| Step           | Endpoint                      | Purpose                              |
| -------------- | ----------------------------- | ------------------------------------ |
| Send OTP       | /otp/send or /ui/otp/send     | Create and deliver a one-time code   |
| Verify OTP     | /otp/verify or /ui/otp/verify | Validate the code and return a token |
| Health         | /health                       | Basic service health check           |
| Validate token | /api/auth/validate            | Check JWT validity                   |
