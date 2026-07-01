## **TextBeeOTP API Keys & Secrets Recap**

### **1. API_KEYS** (Caller Authentication)

- **Purpose:** Authenticates backend services calling OTP endpoints (`/otp/send`, `/otp/verify`, `/health`)
- **Format:** Comma-separated list of keys
- **Header:** `X-API-Key: <key>`
- **Current Value (Production):** `365fc139f15486b0c41a21766ca18e785a46d98b50d63f9ef908a718b2ad8e57`
- **Current Value (Dev):** `963a1aca23be51d523ef280e07420e3e463da76ce1b2783a25b70df54fa5590d`
- **Who uses it:**
  - ✅ **PocketBase gateway** (validates tokens with TextBeeOTP via `X-API-Key` on `/api/auth/validate`)
  - ✅ **Backend services** calling `/otp/send`, `/otp/verify`
  - ✅ **Monitoring/health checks** on `/health`, `/otp/health`

---

### **2. HEALTH_API_KEY** (Optional - Health Monitoring Only)

- **Purpose:** Separate credential for monitoring `/health` and `/otp/health` only
- **Format:** Single key (optional)
- **Header:** `X-API-Key: <health-key>`
- **Current Value:** Not set (using main `API_KEYS` instead)
- **Note:** If set, it's rejected on `/otp/send` and `/otp/verify`

---

### **3. AUTH_TOKEN_SECRET** (Post-OTP Token Signing)

- **Purpose:** Signs short-lived JWT returned after successful OTP verification (5 min default)
- **Usage:** Called by browser to `/api/auth/validate` after verifying OTP
- **Format:** Long random hex string
- **Current Value:** `7f3a9c2e1b6d4f8a0e5c7b9d2f4a6e8c1b3d5f7a9e0c2b4d6f8a1c3e5b7d9f`
- **TTL:** 300 seconds (5 min) — configurable via `AUTH_TOKEN_TTL_SECONDS`
- **Who uses it:**
  - ✅ **PocketBase gateway** (validates the token when PocketBase POSTs to `/api/otp-callback`)
  - ✅ **Upstream apps** that receive the token from the gateway

---

### **4. OTP_SECRET** (OTP Code Generation)

- **Purpose:** HMAC secret for generating OTP codes (not stored plaintext)
- **Format:** Long random hex string
- **Current Value:** `55029eabd36558619d80525f37da1bab2becc18e8571023038e0af4382030300`
- **Usage:** Internal — never exposed to callers
- **Configuration:** `OTP_LENGTH=6`, `OTP_TTL_SECONDS=600`

---

### **5. TEXTBEE_API_KEY** (SMS Provider - TextBee)

- **Purpose:** Authenticate with TextBee SMS gateway (disabled by default, requires `ENABLE_SMS_OTP=true`)
- **Format:** API key from TextBee service
- **Current Value (Production):** `your-api-key` (placeholder — needs real key if SMS enabled)
- **Current Value (Dev):** `your-api-key` (placeholder)
- **Note:** Separate from `API_KEYS` — this is FOR TextBee, not FROM callers

---

### **6. OIDC_CLIENT_SECRET** (OAuth2 / OIDC)

- **Purpose:** Client secret for OIDC provider (if `ENABLE_OIDC=true`)
- **Format:** Long random hex string
- **Current Value:** `d17dd0ee130b2fdc6c9a6931ec3a970dd13abf46c7d58e46b316b5f556501fcf`
- **Usage:** OAuth2 client authentication
- **Status:** Currently disabled (`ENABLE_OIDC=false`)

---

### **7. SMTP_PASS** (Email Provider - Zoho)

- **Purpose:** Password for SMTP server (email OTP delivery)
- **Current Value:** `S8Gn1tUQvzpH`
- **Used with:** `SMTP_USER=972-505414134_278@zohomail.com` @ `smtp.zoho.com:465`

---

## **Configuration Files**

| File              | Location             | Environment           | Keys Defined                                                |
| ----------------- | -------------------- | --------------------- | ----------------------------------------------------------- |
| .env.example      | Repo (tracked)       | Development defaults  | All placeholders                                            |
| .env              | Local device         | Development           | Production/test values                                      |
| app-config.json   | AppSail (production) | Production deployment | Current: API_KEYS, AUTH_TOKEN_SECRET, ALLOWED_ORIGINS, etc. |
| .env.oidc.example | Repo (tracked)       | OIDC-specific         | Alternative config example                                  |
