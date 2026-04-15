# OTP Service

Lightweight verification microservice supporting both SMS (via TextBee) and Email (via Zoho SMTP).

## Features

- **Browser-based Login UI**: Ready-to-use HTML forms for OTP authentication
- **Multi-channel OTP**: SMS and Email support
- **REST API**: Clean endpoints for sending and verifying OTPs
- **Rate limiting**: Built-in protection against abuse
- **Flexible storage**: Redis or in-memory storage options
- **Production hardened**: OTP hashing, layered rate limits, Docker support, comprehensive testing

## Quick Start (Browser UI)

1. Start the server:
   ```bash
   npm install
   npm start
   ```

2. Open in your browser:
   ```
   http://localhost:3008/login
   ```

3. Enter your email or phone number and receive a 6-digit code
4. Enter the code to verify

No backend integration needed — just point users to `/login`!

## API Endpoints

### UI Routes
- `GET /login` - Login form (select email/SMS, enter recipient)
- `GET /verify` - Verification form (enter 6-digit code)

### OTP API
- `POST /otp/send` - Send OTP via SMS or Email
- `POST /otp/verify` - Verify OTP code

## Environment Variables

Create a `.env` file with the following variables:

```bash
# OTP Settings
OTP_TTL_SECONDS=300
OTP_LENGTH=6
OTP_SECRET=replace-with-a-long-random-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=5
VERIFY_RATE_LIMIT_MAX=10

# Request Limits
JSON_BODY_LIMIT=8kb

# Redis (optional - falls back to in-memory if not set)
# For Redis Cloud (redis.io): use rediss:// protocol for TLS
REDIS_URL=rediss://default:password@redis-12345.redis.io:12345
# For local Redis without TLS:
# REDIS_URL=redis://localhost:6379

# SMS Provider (TextBee)
TEXTBEE_API_KEY=your_textbee_api_key_here
TEXTBEE_DEVICE_ID=your_textbee_device_id_here

# Email Provider (Zoho SMTP)
EMAIL_FROM=noreply@yourdomain.com
# SMTP (Zoho)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_zoho_address@yourdomain.com
SMTP_PASS=your_zoho_app_password

# Server Configuration
PORT=3008
NODE_ENV=development
```

## Setup Instructions

### 1. SMS Setup (TextBee)

1. Sign up at [TextBee](https://textbee.dev)
2. Get your API key and device ID
3. Set `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID`

### 2. Email Setup (Zoho SMTP)

1. Set up a Zoho Mail account and create an app password
2. Set `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
3. Set `EMAIL_FROM` to the sender address (usually same as `SMTP_USER`)

### 3. Redis Setup (Optional)

Redis is optional in development. For production, Redis-backed storage is strongly recommended because in-memory OTPs do not survive restarts or horizontal scaling.

#### Redis Cloud (redis.io)

1. Create a free database at [redis.io](https://redis.io)
2. Get your connection details from the dashboard
3. Set the connection URL (use `rediss://` with double 's' for TLS):
   ```bash
   REDIS_URL=rediss://default:your_password@redis-12345.redis.io:12345
   ```

#### Local Redis

For local development:
```bash
REDIS_URL=redis://localhost:6379
```

### 4. Development

1. Install dependencies

   ```bash
   npm install
   ```

2. Run in dev mode
   ```bash
   npm run dev
   ```

## Testing

```bash
npm test
```

## Production Notes

- Set a strong `OTP_SECRET`. In production the service will refuse to start without it.
- OTP values are stored as HMAC hashes, not plaintext.
- `/api-docs` is disabled in production.
- The Redis debug test endpoint has been removed from the production API surface.

## Docker

```bash
docker build -t otp-service .
docker run -p 3000:3000 --env-file .env otp-service
```

## API Usage Examples

### Using the Browser UI

Simply navigate to your running server:

```
http://localhost:3008/login
```

Fill out the form, receive a code, and verify it — no code needed!

### Using the REST API

If you prefer to call the API directly from your own application:

#### Send OTP via SMS

```bash
curl -X POST http://localhost:3008/otp/send \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+1234567890", "channel": "sms"}'
```

#### Send OTP via Email

```bash
curl -X POST http://localhost:3008/otp/send \
  -H "Content-Type: application/json" \
  -d '{"recipient": "user@example.com", "channel": "email"}'
```

#### Verify OTP

```bash
curl -X POST http://localhost:3008/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"recipient": "user@example.com", "code": "123456"}'
```

### Using helper script

```bash
./examples/otp_demo.sh send-email user@example.com
./examples/otp_demo.sh verify user@example.com 123456
```

## Alternative: OIDC Authentication

In addition to the OTP-based login UI above, TextBeeOTP also provides OIDC provider endpoints for integrating with external identity providers (Google, Facebook, GitHub, etc.) via [oauth2-proxy](https://oauth2-proxy.github.io/).

For details, see [OIDC_INTEGRATION.md](OIDC_INTEGRATION.md)

**Summary**: Choose one:
- **OTP UI** (`/login`) — Email/phone code verification, works standalone
- **OIDC** — SSO with external providers like Google, requires oauth2-proxy
