# OTP Service

Lightweight verification microservice supporting both SMS (via TextBee) and Email (via Zoho SMTP).

## Features

- **Multi-channel OTP**: SMS and Email support
- **REST API**: Clean endpoints for sending and verifying OTPs
- **Rate limiting**: Built-in protection against abuse
- **Flexible storage**: Redis or in-memory storage options
- **Production ready**: Docker support, comprehensive testing

## API Endpoints

- `POST /otp/send` - Send OTP via SMS or Email
- `POST /otp/verify` - Verify OTP code

## Environment Variables

Create a `.env` file with the following variables:

```bash
# OTP Settings
OTP_TTL_SECONDS=300
OTP_LENGTH=6

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=5

# Redis (optional - falls back to in-memory if not set)
REDIS_URL=

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
PORT=3000
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

### 3. Development

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

## Docker

```bash
docker build -t otp-service .
docker run -p 3000:3000 --env-file .env otp-service
```

## API Usage Examples

### Send OTP via SMS

```bash
curl -X POST http://localhost:3000/otp/send \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+1234567890", "channel": "sms"}'
```

### Send OTP via Email

```bash
curl -X POST http://localhost:3000/otp/send \
  -H "Content-Type: application/json" \
  -d '{"recipient": "user@example.com", "channel": "email"}'
```

### Verify OTP

```bash
curl -X POST http://localhost:3000/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"recipient": "user@example.com", "code": "123456"}'
```

### Use example script

```bash
./examples/otp_demo.sh send-email user@example.com
./examples/otp_demo.sh verify user@example.com 123456
```
