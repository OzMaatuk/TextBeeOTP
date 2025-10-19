# TextBee OTP Service

Lightweight phone verification microservice using TextBee as SMS provider.

Features:

- POST /otp/send
- POST /otp/verify

See `.env.example` for environment variables.

Development

1. Install dependencies

   npm install

2. Run in dev mode

   npm run dev

Tests

npm test

Docker

docker build -t textbee-otp .
docker run -p 3000:3000 --env-file .env textbee-otp
