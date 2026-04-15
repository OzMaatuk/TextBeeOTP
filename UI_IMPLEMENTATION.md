# TextBeeOTP Login UI - Implementation Summary

## What Was Added

A complete browser-based authentication interface with both OTP and OIDC social login support:

### 1. Method Selector Page (`GET /login`)
- **Purpose**: User chooses authentication method
- **Features**:
  - "Email or Phone" - Direct OTP verification
  - "Continue with Google" - via oauth2-proxy
  - "Continue with GitHub" - via oauth2-proxy
  - "Continue with LinkedIn" - via oauth2-proxy
  - Beautiful card-based UI with hover effects
  - Back button to return to method selector from OTP form

### 2. OTP Form (on /login)
- **Purpose**: User enters email or phone number and selects delivery channel
- **Features**:
  - Toggle between Email and SMS
  - Email/phone input with validation
  - Beautiful gradient UI
  - Real-time feedback
  - Error messages for invalid input

### 3. Verification Page (`GET /verify`)
- **Purpose**: User enters the 6-digit code they received
- **Features**:
  - Code input with auto-formatting (digits only, max 6)
  - Masked recipient display (e.g., `u***@example.com`)
  - 10-minute countdown timer
  - Success confirmation with token display
  - "Start Over" link to return to login

## File Structure

```
src/
├── views/
│   ├── login.html          # Login method selector + OTP form UI
│   └── verify.html         # OTP verification form UI
└── routes/
    └── ui.ts               # Route handlers for /login and /verify

examples/
├── ui_demo.sh              # Demo script (OTP only)
└── oidc_ui_setup.sh        # Complete setup guide for oauth2-proxy integration
```

## Authentication Flows

### Flow 1: Direct OTP (Standalone)

```
/login → User selects "Email or Phone"
  ↓
Enter email/phone and channel
  ↓
POST /otp/send
  ↓
/verify → Enter 6-digit code
  ↓
POST /otp/verify
  ↓
Verification successful!
```

### Flow 2: Social Login (with oauth2-proxy)

```
/login → User selects "Continue with Google"
  ↓
Redirect to oauth2-proxy
  ↓
oauth2-proxy → Google OAuth → Back to oauth2-proxy
  ↓
oauth2-proxy calls TextBeeOTP OIDC endpoints
  ↓
User authenticated, session created
```

## How It Works

### Direct OTP Flow

- User enters recipient (email or phone)
- Frontend calls POST `/otp/send`
- Server sends code via SMS or Email
- Page redirects to `/verify`
- Browser stores recipient and channel in sessionStorage
- User enters code
- Frontend calls POST `/otp/verify` with recipient + code
- Server validates and returns success

### Social Login Flow (requires oauth2-proxy)

1. User clicks "Continue with Google" button
2. Button redirects to oauth2-proxy at `http://localhost:4180/oauth2/start?provider=google`
3. oauth2-proxy handles OAuth2 flow with Google
4. oauth2-proxy redirects user back to original page
5. User is authenticated (oauth2-proxy sets session cookie)

### Configuration

The UI automatically detects oauth2-proxy:
```javascript
const OAUTH2_PROXY_URL = (function() {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  return isDev ? 'http://localhost:4180' : `${window.location.protocol}//${hostname}`;
})();
```

To use a different URL:
```javascript
// In login.html, update OAUTH2_PROXY_URL
const OAUTH2_PROXY_URL = 'https://auth.yourdomain.com';
```

## Implementation Details

### Session Storage
- Uses browser sessionStorage to maintain state between login and verify pages
- Stores: `otpRecipient`, `otpChannel`
- Automatically cleared on browser close
- NOT shared across tabs

### API Integration

The UI calls the existing OTP API endpoints:

**POST /otp/send**
```json
{
  "recipient": "user@example.com",
  "channel": "email"
}
```

**POST /otp/verify**
```json
{
  "recipient": "user@example.com",
  "code": "123456"
}
```

### OIDC Provider Endpoints

TextBeeOTP provides these endpoints for oauth2-proxy:

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/openid-configuration` | OIDC Discovery |
| `/oauth2/authorize` | Authorization endpoint |
| `/oauth2/token` | Token exchange |
| `/oauth2/userinfo` | Get user info |
| `/oauth2/account` | Internal: account linking |

See [OIDC_INTEGRATION.md](OIDC_INTEGRATION.md) for details.

## Features

✅ **Mobile-Friendly**: Responsive design works on all screen sizes  
✅ **No Dependencies**: Pure HTML/CSS/JavaScript (no frameworks)  
✅ **Accessible**: Proper labels, input types, and semantic HTML  
✅ **Beautiful**: Modern gradient design with smooth animations  
✅ **Timer**: 10-minute countdown for code expiration  
✅ **Auto-Format**: Code input automatically formats to numbers only  
✅ **Error Handling**: Clear error messages for each failure case  
✅ **Social Login Ready**: Pre-configured for oauth2-proxy integration  
✅ **Auto-Detection**: Automatically detects oauth2-proxy on localhost  

## Quick Start

### OTP Only
```bash
npm start
# Open: http://localhost:3008/login
```

### With Social Login
```bash
# 1. Enable OIDC in .env
echo "ENABLE_OIDC=true" >> .env

# 2. Set OIDC config
echo "OIDC_CLIENT_ID=oauth2-proxy" >> .env
echo "OIDC_CLIENT_SECRET=your-secret" >> .env

# 3. Start TextBeeOTP
npm start

# 4. Start oauth2-proxy (in another terminal)
# See examples/oidc_ui_setup.sh for complete setup
oauth2-proxy -c oauth2-proxy.cfg
```

## Deployment

The UI pages are served as static files from the Express server:
- No additional dependencies
- Served from `src/views/` directory
- Works in Docker containers
- No build step required (plain HTML)

## Testing

### Manual Testing
```bash
npm start

# Test OTP flow
http://localhost:3008/login
# → Select "Email or Phone"
# → Enter your email
# → Check your email for code
# → Enter code

# Test with oauth2-proxy (if deployed)
# → Select "Continue with Google"
# → Should redirect to oauth2-proxy
```

### Automated Testing
```bash
npm test
```

All 35 existing tests continue to pass. The UI is served as static files and doesn't require additional test coverage.

## Integration with Existing Systems

You can integrate TextBeeOTP in three ways:

### 1. Standalone OTP
- Users navigate to `http://your-domain/login`
- Complete OTP flow serverside
- Link user account after verification

### 2. Self-Hosted Deployment
- Host TextBeeOTP on your domain
- User flow: your-domain/login → TextBeeOTP handles both OTP and OIDC

### 3. Embedded in Your App
- Copy the HTML/CSS/JavaScript from `/login` and `/verify`
- Integrate into your own web app
- Call TextBeeOTP's `/otp/send` and `/otp/verify` endpoints
- oauth2-proxy can still be used for external authentication

## Future Enhancements

Possible improvements:
- Resend code button with timeout
- SMS/Email selection persistence (localStorage)
- Password manager integration
- Multi-language support
- Dark mode toggle
- Extended WCAG accessibility improvements
- Remember this device checkbox
