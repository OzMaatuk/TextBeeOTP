# OTP Service

Lightweight verification microservice supporting both SMS (via TextBee) and Email (via Zoho SMTP).

## Features

- **Browser-based Login UI**: Ready-to-use HTML forms for OTP authentication
- **Multi-channel OTP**: SMS and Email support
- **REST API**: Clean endpoints for sending and verifying OTPs
- **Caller Authentication**: API key auth on all endpoints via `X-API-Key` header
- **Rate limiting**: Built-in protection against abuse
- **Environment-aware CORS**: Locked to allowed origins in production
- **Flexible storage**: Redis or in-memory storage options
- **Production hardened**: OTP hashing, layered rate limits, Docker support, comprehensive testing

## Quick Start (Browser UI)

### OTP Only (Standalone)

1. Start the server:
   ```bash
   npm install
   npm start
   ```

2. Open in your browser:
   ```
   http://localhost:3008/login
   ```

3. Choose "Email or Phone" and enter your recipient
4. Enter the 6-digit code you receive

The browser UI calls `/ui/otp/send` and `/ui/otp/verify` — proxy routes that call the OTP service internally. No API key is needed in the browser. Backend callers use `/otp/send` and `/otp/verify` with an `X-API-Key` header.

### With Social Login (Google, Facebook, etc.)

To add "Continue with Google" / "Continue with Facebook" buttons to the login page, deploy [oauth2-proxy](https://oauth2-proxy.github.io/) alongside TextBeeOTP:

1. Set up oauth2-proxy pointing to TextBeeOTP's OIDC provider:
   ```bash
   oauth2-proxy \
     --provider=oidc \
     --oidc-issuer-url=http://localhost:3008 \
     --client-id=oauth2-proxy \
     --client-secret=your-secret \
     --redirect-url=http://localhost:4180/oauth2/callback \
     --upstreams=http://localhost:3008 \
     --http-address=0.0.0.0:4180
   ```

2. Enable OIDC in TextBeeOTP (set `ENABLE_OIDC=true` in `.env`)

3. Open in your browser:
   ```
   http://localhost:3008/login
   ```

4. You'll now see both options: direct OTP verification and social login buttons

For complete oauth2-proxy setup instructions, see [OIDC_INTEGRATION.md](OIDC_INTEGRATION.md)

## API Endpoints

All `/otp/*` and `/health` endpoints require an `X-API-Key` header. UI routes do not. See [API Authentication](docs/API_AUTHENTICATION.md) for setup and examples.

### UI Routes (no auth required — browser facing)
- `GET /login` - Login form
- `GET /verify` - Verification form
- `POST /ui/otp/send` - Send OTP (used by browser UI internally)
- `POST /ui/otp/verify` - Verify OTP (used by browser UI internally)

### API Routes (X-API-Key required — backend callers)
- `POST /otp/send` - Send OTP
- `POST /otp/verify` - Verify OTP
- `GET /health` - Service health status
- `GET /otp/health` - OTP subsystem health

## Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# OTP Settings
OTP_TTL_SECONDS=300
OTP_LENGTH=6
OTP_SECRET=replace-with-a-long-random-secret

# Caller Authentication (required in production)
API_KEYS=your-api-key-here,optional-second-key
HEALTH_API_KEY=your-health-monitor-key   # optional, health endpoints only

# CORS (required in production)
ALLOWED_ORIGINS=https://your-frontend.com

# Proxy trust (required in production)
TRUST_PROXY=1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=5
VERIFY_RATE_LIMIT_MAX=10

# Redis (optional - falls back to in-memory if not set)
REDIS_URL=rediss://default:password@redis-12345.redis.io:12345

# SMS Provider (TextBee)
TEXTBEE_API_KEY=your_textbee_api_key_here
TEXTBEE_DEVICE_ID=your_textbee_device_id_here

# Email Provider (Zoho SMTP)
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_zoho_address@yourdomain.com
SMTP_PASS=your_zoho_app_password

# Server ports (same port works fine; separate ports give cleaner isolation)
API_PORT=3008
UI_PORT=3008
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

For local run using the docker-compose:
edit the following lines in docker-compose.yml
```bash
    command: redis-server --appendonly yes --requirepass "YOUR_REDIS_PASSWORD"
      test: ['CMD', 'redis-cli', '-a', 'YOUR_REDIS_PASSWORD', 'ping']
      - REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@redis:6379
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
- Set `API_KEYS` to one or more comma-separated secrets. The service refuses to start in production without it.
- Set `ALLOWED_ORIGINS` to your frontend domain(s). Defaults to `*` in non-production.
- Set `TRUST_PROXY` to match your infrastructure (e.g. `1` behind a single load balancer).
- Same port for `API_PORT` and `UI_PORT` works fine — the UI proxy routes are mounted before the auth middleware so browsers are never blocked.
- OTP values are stored as HMAC hashes, not plaintext.
- `/api-docs` is disabled in production.
- API key values are never written to logs.

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

Fill out the form, receive a code, and verify it. The UI handles everything — no API key needed in the browser.

### Using the REST API

If you prefer to call the API directly from your own application, all requests require an `X-API-Key` header. See [API Authentication](docs/API_AUTHENTICATION.md) for full details.

#### Send OTP via SMS

```bash
curl -X POST http://localhost:3008/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "+1234567890", "channel": "sms"}'
```

#### Send OTP via Email

```bash
curl -X POST http://localhost:3008/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "user@example.com", "channel": "email"}'
```

#### Verify OTP

```bash
curl -X POST http://localhost:3008/otp/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "user@example.com", "code": "123456"}'
```

#### Check health

```bash
curl http://localhost:3008/health \
  -H "X-API-Key: your-api-key-here"
```

### Using helper script

```bash
./examples/otp_demo.sh send-email user@example.com
./examples/otp_demo.sh verify user@example.com 123456
```

## Alternative: OIDC Authentication

In addition to the OTP-based login UI above, TextBeeOTP also provides OIDC provider endpoints for integrating with external identity providers (Google, Facebook, etc.) via [oauth2-proxy](https://oauth2-proxy.github.io/).

For details, see [OIDC_INTEGRATION.md](OIDC_INTEGRATION.md)

**Summary**: Choose one:
- **OTP UI** (`/login`) — Email/phone code verification, works standalone
- **OIDC** — SSO with external providers like Google, requires oauth2-proxy
