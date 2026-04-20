# API Authentication

All endpoints on the OTP service require a valid API key passed in the `X-API-Key` request header. Requests without a valid key receive `401 {"error":"unauthorized"}`.

## Port Separation

The service runs two Express apps. How they're served depends on your port config:

| Scenario | How it works |
|---|---|
| `API_PORT != UI_PORT` | Two separate servers. UI on `UI_PORT`, API on `API_PORT`. |
| `API_PORT == UI_PORT` | Single server. Both apps share one port — works correctly. |

In both cases the request routing is the same:

| Path | Auth required | Who calls it |
|---|---|---|
| `GET /login`, `GET /verify` | No | Browsers |
| `POST /ui/otp/send`, `POST /ui/otp/verify` | No | Browser UI (calls OTP service internally) |
| `POST /otp/send`, `POST /otp/verify` | Yes — `X-API-Key` | Backend services |
| `GET /health`, `GET /otp/health` | Yes — `X-API-Key` | Backend / monitoring |

The UI proxy routes (`/ui/otp/*`) are mounted before the auth middleware, so browsers never need an API key. The API key never reaches the browser.

---

## Setup

### 1. Generate a key

Use any method that produces a hard-to-guess secret:

```bash
# openssl (recommended)
openssl rand -hex 32

# node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Add it to your `.env`

```dotenv
# One key
API_KEYS=a3f9c2e1b8d74f6a...

# Multiple keys (comma-separated) — useful for key rotation
API_KEYS=a3f9c2e1b8d74f6a...,b7e2d4c9f1a83e5b...

# Optional: separate key for monitoring/health checks only
HEALTH_API_KEY=monitor-secret-here
```

`HEALTH_API_KEY` is accepted on `/health` and `/otp/health` only — it is rejected on `/otp/send` and `/otp/verify`. This lets you give your monitoring system a separate credential with limited scope.

### 3. Production requirements

In production (`NODE_ENV=production`) the server refuses to start if any of these are missing:

| Variable | Purpose |
|---|---|
| `API_KEYS` | Caller authentication |
| `ALLOWED_ORIGINS` | CORS origin allowlist |
| `TRUST_PROXY` | Proxy hop count for rate limiter IP detection |

---

## Making Authenticated Requests

Add the `X-API-Key` header to every request.

### curl

```bash
# Send OTP via email
curl -X POST https://your-service/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "user@example.com", "channel": "email"}'

# Send OTP via SMS
curl -X POST https://your-service/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "+1234567890", "channel": "sms"}'

# Verify OTP
curl -X POST https://your-service/otp/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"recipient": "user@example.com", "code": "123456"}'

# Health check
curl https://your-service/health \
  -H "X-API-Key: your-api-key-here"
```

### JavaScript (fetch)

```js
const API_KEY = process.env.OTP_SERVICE_API_KEY;
const BASE_URL = 'https://your-service';

async function sendOtp(recipient, channel) {
  const res = await fetch(`${BASE_URL}/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ recipient, channel }),
  });
  if (!res.ok) throw new Error(`OTP send failed: ${res.status}`);
  return res.json();
}

async function verifyOtp(recipient, code) {
  const res = await fetch(`${BASE_URL}/otp/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ recipient, code }),
  });
  if (!res.ok) throw new Error(`OTP verify failed: ${res.status}`);
  return res.json();
}
```

### Python (requests)

```python
import os
import requests

API_KEY = os.environ["OTP_SERVICE_API_KEY"]
BASE_URL = "https://your-service"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

def send_otp(recipient: str, channel: str = "email"):
    r = requests.post(f"{BASE_URL}/otp/send", json={"recipient": recipient, "channel": channel}, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def verify_otp(recipient: str, code: str):
    r = requests.post(f"{BASE_URL}/otp/verify", json={"recipient": recipient, "code": code}, headers=HEADERS)
    r.raise_for_status()
    return r.json()
```

---

## Error Responses

| Scenario | Status | Body |
|---|---|---|
| Missing `X-API-Key` header | `401` | `{"error":"unauthorized"}` |
| Invalid key value | `401` | `{"error":"unauthorized"}` |
| Health key used on non-health route | `401` | `{"error":"unauthorized"}` |

Authentication failures are logged at `warn` level with the request path, method, and source IP — the submitted key value is never logged.

---

## Key Rotation

To rotate keys without downtime:

1. Add the new key alongside the old one in `API_KEYS`:
   ```dotenv
   API_KEYS=old-key,new-key
   ```
2. Restart the service.
3. Update all callers to use the new key.
4. Remove the old key from `API_KEYS` and restart again.

---

## CORS

If your frontend calls the API from a browser, set `ALLOWED_ORIGINS` to your frontend's origin:

```dotenv
ALLOWED_ORIGINS=https://app.yourdomain.com

# Multiple origins
ALLOWED_ORIGINS=https://app.yourdomain.com,https://staging.yourdomain.com
```

Requests from origins not in this list will be blocked by the browser (the server omits the `Access-Control-Allow-Origin` header). In non-production environments with no `ALLOWED_ORIGINS` set, all origins are allowed (`*`).
