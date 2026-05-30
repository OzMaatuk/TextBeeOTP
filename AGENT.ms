# TextBeeOTP - AGENT.ms

## Project Overview

**TextBeeOTP** is a lightweight, production-ready microservice for phone and email verification using OTP (One-Time Passwords). It provides both a browser-based UI and REST API endpoints for SMS (TextBee) and Email (Zoho SMTP) channels.

- **Repository**: OzMaatuk/TextBeeOTP
- **Language**: TypeScript (78.9%), HTML (11.3%), JavaScript (9.2%), Dockerfile (0.6%)
- **Type**: Microservice
- **Purpose**: Multi-channel OTP verification service with OIDC support

---

## Key Features

- **Multi-channel OTP**: SMS via TextBee and Email via Zoho SMTP
- **Browser UI**: Ready-to-use HTML forms at `/login` for standalone OTP auth
- **REST API**: Clean endpoints for programmatic OTP sending and verification
- **Authentication**: API key validation via `X-API-Key` header
- **Rate Limiting**: Built-in abuse protection (configurable per endpoint)
- **Storage Options**: Redis (production) or in-memory (development)
- **OIDC Integration**: Compatible with oauth2-proxy for social login
- **Security**: OTP hashing, environment-aware CORS, production hardening
- **Testing**: Jest with property-based testing (fast-check)

---

## Project Structure

```
TextBeeOTP/
├── src/
│   ├── index.ts              # Application entry point
│   ├── views/                # HTML UI templates
│   ├── types/                # TypeScript type definitions
│   ├── controllers/          # Route handlers
│   ├── services/             # Business logic (OTP, Auth, etc.)
│   ├── middleware/           # Express middleware
│   └── utils/                # Utilities and helpers
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Test configuration
├── Dockerfile                # Container image definition
├── .env.example              # Environment template
├── README.md                 # User documentation
├── AGENT.ms                  # This file
└── docs/
    └── API_AUTHENTICATION.md # API key setup guide
```

---

## Technology Stack

### Core
- **Runtime**: Node.js ≥20
- **Framework**: Express.js 5.1.0
- **Language**: TypeScript 5.9.3 (strict mode)
- **Module System**: ES modules

### Key Dependencies
- **Database/Cache**: ioredis 5.8.2 (Redis client)
- **HTTP Client**: axios 1.13.2
- **Security**: helmet 8.1.0, express-rate-limit 8.2.1
- **Validation**: zod 4.1.12 (schema validation)
- **Authentication**: oidc-provider 9.8.0 (OIDC endpoints)
- **Logging**: pino 10.1.0 with pino-pretty for dev
- **Email**: nodemailer 7.0.10
- **Config**: dotenv 17.2.3
- **Utilities**: uuid 13.0.0

### Development Tools
- **Testing**: jest 30.2.0 + ts-jest 29.4.5 + supertest 7.1.4
- **Linting**: eslint 9.39.1 + typescript-eslint
- **Formatting**: prettier 3.6.2
- **Property Testing**: fast-check 4.7.0
- **Dev Runner**: ts-node-dev 2.0.0
- **API Docs**: swagger-ui-express 5.0.1

---

## Environment Configuration

The service requires a `.env` file with the following categories:

### OTP Settings
```
OTP_TTL_SECONDS=300          # OTP validity period (seconds)
OTP_LENGTH=6                 # OTP code length
OTP_SECRET=<long-random>     # Secret for HMAC hashing (required in production)
```

### Authentication
```
API_KEYS=<key1>,<key2>       # Comma-separated API keys (required in production)
HEALTH_API_KEY=<health-key>  # Optional separate key for health endpoints
```

### CORS & Security
```
ALLOWED_ORIGINS=https://your-frontend.com  # Required in production
TRUST_PROXY=1                # Set based on infrastructure
```

### Rate Limiting
```
RATE_LIMIT_WINDOW_MS=60000   # Sliding window (ms)
RATE_LIMIT_MAX=5             # Max requests per window
VERIFY_RATE_LIMIT_MAX=10     # Max verify attempts per window
```

### Storage
```
REDIS_URL=rediss://default:password@redis.example.com:12345  # Optional
```

### SMS (TextBee)
```
TEXTBEE_API_KEY=<your-key>
TEXTBEE_DEVICE_ID=<your-device>
```

### Email (Zoho SMTP)
```
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<your-zoho-email>
SMTP_PASS=<your-app-password>
```

### Server
```
API_PORT=3008
UI_PORT=3008
NODE_ENV=development|production
ENABLE_OIDC=false  # Set to true for oauth2-proxy integration
```

---

## API Endpoints

### Public UI Routes (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/login` | Login form page |
| GET | `/verify` | OTP verification form |
| POST | `/ui/otp/send` | Send OTP (browser) |
| POST | `/ui/otp/verify` | Verify OTP (browser) |

### Protected API Routes (X-API-Key required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/otp/send` | Send OTP |
| POST | `/otp/verify` | Verify OTP |
| GET | `/health` | Service health |
| GET | `/otp/health` | OTP subsystem health |

### OIDC Endpoints (if enabled)
- `GET /.well-known/openid-configuration` - OIDC configuration
- `POST /token` - Token endpoint
- `GET /authorization` - Authorization endpoint
- Other standard OIDC endpoints

---

## Build & Run

### Development
```bash
npm install                    # Install dependencies
npm run build:watch           # TypeScript in watch mode
npm run dev                   # Build and run
npm run lint                  # ESLint
npm run format                # Prettier
npm test                      # Jest with coverage
```

### Production
```bash
npm install --omit=dev       # Install production dependencies only
npm run build                # Compile TypeScript to dist/
npm start                    # Run compiled JavaScript
```

### Docker
```bash
docker build -t otp-service .
docker run -p 3008:3008 --env-file .env otp-service
```

---

## Key Patterns & Conventions

### TypeScript
- **Strict mode** enabled in `tsconfig.json`
- **ES2020 target** with ESNext modules
- **Type definitions** in `src/types/` directory
- **Interface-driven** architecture for extensibility

### Express Middleware Stack
1. Helmet for security headers
2. Rate limiting (global + per-endpoint)
3. CORS (environment-aware)
4. Body parsing (JSON)
5. Request logging (pino)
6. API key validation (except UI routes)
7. Route handlers

### Data Validation
- **Zod schemas** for request/response validation
- Type-safe API contracts
- Automatic error responses on validation failure

### Error Handling
- Structured error responses
- HTTP status codes reflect intent
- Error details hidden in production
- Pino logger for all errors

### Testing
- Jest configuration in `jest.config.js`
- Test files: `**/*.test.ts` and `**/*.spec.ts`
- Property-based testing with fast-check
- Mock support via ioredis-mock
- Supertest for HTTP testing

### Security
- OTP values stored as HMAC hashes (never plaintext)
- API key values never logged
- Rate limiting on send/verify endpoints
- CORS restricted to `ALLOWED_ORIGINS` in production
- Helmet security headers enabled
- Proxy trust configured for load balancers

---

## Dependencies Overview

### Why Each is Included

| Package | Purpose |
|---------|---------|
| `express` | HTTP server framework |
| `typescript` | Type safety and tooling |
| `zod` | Runtime schema validation |
| `ioredis` | Redis client for distributed caching |
| `ioredis-mock` | In-memory Redis mock for tests |
| `pino` | Structured logging |
| `helmet` | Security headers middleware |
| `express-rate-limit` | Abuse prevention |
| `axios` | HTTP client (TextBee API calls) |
| `nodemailer` | Email sending (Zoho SMTP) |
| `uuid` | OTP session identifiers |
| `oidc-provider` | OIDC provider for oauth2-proxy |
| `dotenv` | Environment variable loading |
| `jest` + `ts-jest` | Unit and integration testing |
| `supertest` | HTTP endpoint testing |
| `fast-check` | Property-based testing |
| `eslint` + `prettier` | Code quality and formatting |

---

## Common Development Tasks

### Adding a New Endpoint
1. Create a route handler in `src/controllers/`
2. Define request/response schemas with Zod in `src/types/`
3. Add route to Express app (protect with auth middleware if needed)
4. Write tests in `__tests__/` directory
5. Update API documentation

### Modifying OTP Logic
- Core OTP service: `src/services/otpService.ts`
- Storage layer: `src/services/storageService.ts`
- Hash/security: `src/utils/crypto.ts`

### Adding a New Channel (SMS/Email)
1. Implement channel interface in `src/types/channels.ts`
2. Create handler in `src/services/channels/`
3. Add configuration to `.env`
4. Update OTP service to route to new handler
5. Test with real credentials or mocks

### Debugging
- Set `NODE_ENV=development` for verbose logs
- Use `DEBUG=*` with pino for all output
- Jest in watch mode: `npm test -- --watch`
- TypeScript compilation errors are strict

---

## Production Checklist

- [ ] Set strong `OTP_SECRET` (min 32 random characters)
- [ ] Set `API_KEYS` to secure comma-separated values
- [ ] Configure `ALLOWED_ORIGINS` to exact frontend domain(s)
- [ ] Set `TRUST_PROXY` per infrastructure (e.g., `1` for single LB)
- [ ] Provide Redis connection (`REDIS_URL`) for state persistence
- [ ] Configure TextBee credentials (`TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`)
- [ ] Configure email provider (Zoho SMTP environment variables)
- [ ] Set `NODE_ENV=production`
- [ ] Verify rate limiting thresholds suit traffic patterns
- [ ] Confirm `/api-docs` is disabled in production
- [ ] Set up health check monitoring on `/health`
- [ ] Enable OIDC if using oauth2-proxy integration
- [ ] Test OTP delivery with real phone/email
- [ ] Review logs and error tracking in production

---

## Troubleshooting

### OTP Not Sending
1. Check TextBee API credentials in `.env`
2. Verify SMTP credentials if using email
3. Check rate limiting (`RATE_LIMIT_MAX`)
4. Review pino logs for API errors
5. Confirm Redis connection if in use

### API Key Validation Failing
1. Ensure `X-API-Key` header is present
2. Verify key matches one in `API_KEYS`
3. Confirm endpoint is protected (not UI routes)
4. Check for extra whitespace in env variables

### TypeScript Compilation Errors
1. Run `npm install` to ensure types are installed
2. Check `tsconfig.json` target and module settings
3. Verify all imports use correct module resolution
4. Run `npm run lint` to catch type issues

### Redis Connection Issues
1. Test with `REDIS_URL=redis://localhost:6379` locally
2. For cloud Redis, use `rediss://` (double 's' for TLS)
3. Verify firewall allows connection to Redis endpoint
4. Check password in connection string

---

## Related Documentation

- **User Guide**: `README.md`
- **API Authentication**: `docs/API_AUTHENTICATION.md`
- **OIDC Integration**: `OIDC_INTEGRATION.md`
- **Examples**: `examples/otp_demo.sh`

---

## License

MIT

---

## Last Updated

Generated: May 30, 2026  
Repository: https://github.com/OzMaatuk/TextBeeOTP
