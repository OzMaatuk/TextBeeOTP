# TextBeeOTP Authentication Guide

TextBeeOTP supports two **independent** authentication methods. Choose one based on your use case:

- **Method 1: OIDC + External Providers** — Use Google, Facebook, GitHub, etc. for SSO
- **Method 2: OTP Verification** — Email/phone code verification via REST API

Both can be enabled simultaneously and users/apps can choose which to use.

---

## Method 1: OIDC Authentication (External Providers)

### Overview

The OIDC provider acts as an identity provider bridge. It works with **oauth2-proxy** to delegate authentication to external providers (Google, Facebook, GitHub, etc.). TextBeeOTP doesn't handle the login UI — oauth2-proxy and the external provider do.

### Architecture

```
User Browser
    ↓
oauth2-proxy (port 4180)
    ↓ (redirects to external provider)
Google/Facebook Login
    ↓ (auth code)
oauth2-proxy again
    ↓ (exchanges code for token)
TextBeeOTP OIDC Endpoints (port 3008)
    ↓ (provides userinfo)
oauth2-proxy sets SSO cookie
    ↓
User accesses protected app
```

### OIDC Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/openid-configuration` | GET | Discovery endpoint (required by oauth2-proxy) |
| `/oauth2/authorize` | GET | Authorization endpoint |
| `/oauth2/token` | POST | Token exchange endpoint |
| `/oauth2/userinfo` | GET | Get user info with access token |
| `/oauth2/account` | POST | Create/link external provider account (internal API) |

### Configuration

```bash
# Enable OIDC provider
export ENABLE_OIDC=true

# OIDC Server URL (issuer URL for oauth2-proxy)
export OIDC_SERVER_URL=https://auth.example.com

# Client credentials for oauth2-proxy
export OIDC_CLIENT_ID=oauth2-proxy
export OIDC_CLIENT_SECRET=your-secret-key

# Allowed redirect URIs (comma-separated)
export OIDC_REDIRECT_URIS=http://localhost:4180/oauth2/callback,https://your-app.com/oauth2/callback

npm start
```

### Example: oauth2-proxy Configuration

```bash
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://auth.example.com \
  --client-id=oauth2-proxy \
  --client-secret=your-secret-key \
  --redirect-url=http://localhost:4180/oauth2/callback \
  --upstreams=http://localhost:8080 \
  --http-address=0.0.0.0:4180
```

Then users access your app through oauth2-proxy:
- `http://localhost:4180` → Protected by OIDC authentication
- `http://localhost:8080` → Your actual app (receives authenticated user info via headers)

### OIDC Discovery Response

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/oauth2/authorize",
  "token_endpoint": "https://auth.example.com/oauth2/token",
  "userinfo_endpoint": "https://auth.example.com/oauth2/userinfo",
  "scopes_supported": ["openid", "profile", "email"],
  "claims_supported": ["sub", "email", "email_verified", "name", "picture"],
  ...
}
```

### UserInfo Response Example

```json
{
  "sub": "google_123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://example.com/avatar.jpg"
}
```

---

## Method 2: OTP Verification (REST API)

### Overview

Direct email/phone verification using one-time passwords. Users can call the REST API directly to send and verify OTP codes. This is perfect for:
- Custom login UIs
- Mobile apps
- CLI tools
- Any client that makes HTTP requests

### OTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/otp/send` | POST | Send OTP code via email or SMS |
| `/otp/verify` | POST | Verify OTP code |
| `/otp/health` | GET | Health check with provider status |

### Send OTP

```bash
curl -X POST http://localhost:3008/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "user@example.com",
    "channel": "email"
  }'
```

**Request:**
- `recipient` (string): Email address or phone number (e.g., `user@example.com` or `+1234567890`)
- `channel` (string): `email` or `sms`

**Response (200 OK):**
```json
{
  "status": "sent"
}
```

**Error Responses:**
- `400 Bad Request` — Invalid input
- `429 Too Many Requests` — Rate limited (5 per minute per recipient)
- `502 Bad Gateway` — Email/SMS provider failure

### Verify OTP

```bash
curl -X POST http://localhost:3008/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "user@example.com",
    "code": "123456"
  }'
```

**Request:**
- `recipient` (string): Same as used in send request
- `code` (string): OTP code from email/SMS (4-10 digits)

**Response (200 OK):**
```json
{
  "status": "verified"
}
```

**Error Responses:**
- `400 Bad Request` — Invalid code, expired code, or invalid format
- `429 Too Many Requests` — Rate limited (10 per minute per recipient)
- `500 Internal Server Error` — Server error

### Configuration

```bash
# OTP Settings
export OTP_TTL_SECONDS=600           # Code validity: 10 minutes
export OTP_LENGTH=6                  # Code length: 6 digits
export OTP_SECRET=your-secret-key    # Encryption key (required in production)

# Email Provider (example: Zoho Mail)
export SMTP_HOST=smtp.zoho.com
export SMTP_PORT=465
export SMTP_SECURE=true
export SMTP_USER=sender@example.com
export SMTP_PASS=app-password
export EMAIL_FROM=noreply@example.com

# SMS Provider (TextBee API)
export TEXTBEE_API_KEY=your-api-key
export TEXTBEE_DEVICE_ID=your-device-id

# Rate Limiting
export RATE_LIMIT_WINDOW_MS=60000    # 1 minute window
export RATE_LIMIT_MAX=5              # Max 5 sends per window
export VERIFY_RATE_LIMIT_MAX=10      # Max 10 verifications per window

npm start
```

### Example: Building a Login UI

```html
<!-- Step 1: Send OTP -->
<form id="sendForm">
  <input type="email" id="email" placeholder="Enter email" required />
  <button type="submit">Send Code</button>
</form>

<script>
document.getElementById('sendForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  
  const response = await fetch('/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: email, channel: 'email' })
  });
  
  if (response.ok) {
    // Show Step 2 form
  } else {
    alert('Failed to send code');
  }
});
</script>

<!-- Step 2: Verify OTP -->
<form id="verifyForm">
  <input type="text" id="code" placeholder="Enter 6-digit code" required />
  <button type="submit">Verify</button>
</form>

<script>
document.getElementById('verifyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const code = document.getElementById('code').value;
  
  const response = await fetch('/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: email, code })
  });
  
  if (response.ok) {
    // User authenticated! Set session cookie
    window.location.href = '/dashboard';
  } else {
    alert('Invalid code');
  }
});
</script>
```

---

## Choosing Between Methods

### Use **OIDC + External Providers** if:
- You want SSO with Google, Facebook, GitHub, etc.
- You don't want to manage user accounts
- You need enterprise authentication (SAML, Okta, etc.)
- Users are already using these platforms
- You want fast setup with oauth2-proxy

### Use **OTP Verification** if:
- You need phone/email verification
- You have a custom login experience
- You're building a mobile app
- You need simpler deployment (no oauth2-proxy)
- You want direct control over authentication flow
- You need to verify phone numbers for account recovery

---

## Both Enabled Example

```bash
# Configure both authentication methods
export ENABLE_OIDC=true
export OIDC_SERVER_URL=https://auth.example.com
export OIDC_CLIENT_ID=oauth2-proxy

# Enable email/SMS OTP
export SMTP_USER=sender@example.com
export SMTP_PASS=password
export TEXTBEE_API_KEY=your-key

npm start
```

Now users can:
1. **OIDC Path**: Click "Login with Google" → oauth2-proxy → redirected to protected app
2. **OTP Path**: Enter email → verify code → authenticated

---

## Security Considerations

### OIDC Mode
- ✅ Uses oauth2-proxy (battle-tested)
- ✅ No passwords stored
- ✅ Industry-standard OIDC flow
- ⚠️ Requires HTTPS in production
- ⚠️ Depends on external provider availability

### OTP Mode
- ✅ No passwords needed
- ✅ Works offline (if implemented without network)
- ✅ Time-limited codes (configurable)
- ⚠️ Rate limiting prevents brute force (5 per minute)
- ⚠️ Codes sent via external providers (email/SMS)
- ⚠️ OTP_SECRET must be set in production (encryption key)

### General
- Always use HTTPS in production
- Protect environment variables (especially secrets)
- Monitor rate limit metrics
- Keep OTP TTL reasonable (600s default)
- Regularly rotate secrets

---

## Troubleshooting

### OIDC Issues

**Discovery endpoint returns 404**
- Verify `ENABLE_OIDC=true`
- Check logs for OIDC initialization errors

**oauth2-proxy can't get userinfo**
- Verify OIDC server is accessible from oauth2-proxy
- Check OIDC_CLIENT_ID and OIDC_CLIENT_SECRET match
- Verify token has `openid` scope

### OTP Issues

**OTP not received**
- Check email/SMS provider credentials
- Verify recipient format (email@example.com or +1234567890)
- Check rate limit (5 per minute)
- View logs for provider errors

**OTP verification fails**
- Code expired (default 10 minutes) — resend
- Wrong recipient used in verify
- Rate limit exceeded

---

## File Structure

```
src/
├── oidc/
│   ├── provider.ts       # OIDC provider with external auth support
│   └── routes.ts         # OIDC health endpoints
├── routes/
│   └── otp.ts            # OTP send/verify REST endpoints
├── services/
│   └── otpService.ts     # OTP business logic
└── ...
```

---

## API Reference

See [OTP Routes](src/routes/otp.ts) and [OIDC Provider](src/oidc/provider.ts) for complete implementation details.
