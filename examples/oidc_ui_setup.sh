#!/bin/bash

# TextBeeOTP with Social Login (oauth2-proxy) - Setup Example
# This demonstrates how to run TextBeeOTP with oauth2-proxy for Google/GitHub login

echo "========================================="
echo "TextBeeOTP + oauth2-proxy Setup Guide"
echo "========================================="
echo ""
echo "This example shows how to set up TextBeeOTP with oauth2-proxy"
echo "to enable social login (Google, GitHub, etc.)"
echo ""
echo "📋 Step 1: Set up OIDC in TextBeeOTP"
echo "-----------"
echo "Create or update .env:"
cat <<'EOF'
ENABLE_OIDC=true
OIDC_SERVER_URL=http://localhost:3008
OIDC_CLIENT_ID=oauth2-proxy
OIDC_CLIENT_SECRET=your-super-secret-key
OIDC_REDIRECT_URIS=http://localhost:4180/oauth2/callback

OTP_TTL_SECONDS=300
OTP_LENGTH=6
OTP_SECRET=your-otp-secret-key

EMAIL_FROM=noreply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EOF
echo ""
echo "Then start TextBeeOTP:"
echo "  npm start"
echo ""
echo "✅ TextBeeOTP OIDC is now running at:"
echo "   - Discovery: http://localhost:3008/.well-known/openid-configuration"
echo "   - Login UI: http://localhost:3008/login (just shows OTP for now)"
echo ""
echo "📋 Step 2: Get OAuth credentials from your providers"
echo "----------"
echo "From Google Cloud Console:"
echo "  1. Go to https://console.cloud.google.com"
echo "  2. Create OAuth 2.0 credentials (OAuth consent screen + Web app)"
echo "  3. Authorized redirect URI: http://localhost:4180/oauth2/callback"
echo "  4. Save Client ID and Client Secret"
echo ""
echo "From GitHub:"
echo "  1. Go to Settings → Developer settings → OAuth Apps"
echo "  2. Create new OAuth App"
echo "  3. Authorization callback URL: http://localhost:4180/oauth2/callback"
echo "  4. Save Client ID and Client Secret"
echo ""
echo "📋 Step 3: Install and run oauth2-proxy"
echo "----------"
echo "Download from: https://github.com/oauth2-proxy/oauth2-proxy/releases"
echo ""
echo "Create oauth2-proxy config file (oauth2-proxy.cfg):"
cat <<'EOF'
http_address = "0.0.0.0:4180"
upstreams = "http://localhost:3008"
cookie_secret = "your-super-secret-cookie-key"
client_id = "YOUR_GOOGLE_CLIENT_ID"
client_secret = "YOUR_GOOGLE_CLIENT_SECRET"
oidc_issuer_url = "http://localhost:3008"
provider = "oidc"
redirect_url = "http://localhost:4180/oauth2/callback"
skip_provider_button = false
EOF
echo ""
echo "Run oauth2-proxy:"
echo "  oauth2-proxy -c oauth2-proxy.cfg"
echo ""
echo "📋 Step 4: Test the login UI"
echo "----------"
echo "Open in browser:"
echo "  http://localhost:3008/login"
echo ""
echo "You should now see:"
echo "  ✓ Email/Phone OTP option"
echo "  ✓ Continue with Google button"
echo "  ✓ Continue with GitHub button"
echo ""
echo "Click any social login button and it will redirect to oauth2-proxy,"
echo "which handles the OAuth2 flow and redirects back with a user session."
echo ""
echo "========================================="
echo "Architecture:"
echo "========================================="
echo ""
echo "User → oauth2-proxy → Google/GitHub OAuth → oauth2-proxy → User session"
echo "                      ↓"
echo "                TextBeeOTP OIDC endpoints"
echo "                (.well-known/, /oauth2/authorize, /oauth2/token, /oauth2/userinfo)"
echo ""
echo "TextBeeOTP provides OIDC endpoints, oauth2-proxy handles UI and OAuth flows."
echo ""
echo "========================================="
