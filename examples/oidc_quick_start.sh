#!/bin/bash

# TextBeeOTP OIDC Quick Start
# This script demonstrates how to start the OTP server with OIDC enabled

# Configuration
export ENABLE_OIDC=true
export OIDC_SERVER_URL=${OIDC_SERVER_URL:-http://localhost:3008}
export OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-oauth2-proxy}
export OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET:-$(openssl rand -hex 32)}
export OIDC_REDIRECT_URIS=${OIDC_REDIRECT_URIS:-http://localhost:4180/oauth2/callback}

# OTP Configuration
export OTP_TTL_SECONDS=600
export OTP_LENGTH=6
export OTP_SECRET=${OTP_SECRET:-$(openssl rand -hex 32)}

# Optional: Configure Email Provider (for development, use nodemailer mock mode)
# export SMTP_HOST=smtp.example.com
# export SMTP_PORT=465
# export SMTP_USER=sender@example.com
# export SMTP_PASS=your-password
# export EMAIL_FROM=noreply@example.com

# Optional: Configure TextBee SMS Provider
# export TEXTBEE_API_KEY=your-api-key
# export TEXTBEE_DEVICE_ID=your-device-id

# Build and start the server
echo "Building TextBeeOTP..."
npm run build

echo ""
echo "========================================="
echo "OIDC Configuration:"
echo "========================================="
echo "Server URL: $OIDC_SERVER_URL"
echo "Client ID: $OIDC_CLIENT_ID"
echo "Client Secret: $OIDC_CLIENT_SECRET"
echo "Redirect URIs: $OIDC_REDIRECT_URIS"
echo ""
echo "========================================="
echo "TextBeeOTP OIDC Setup with oauth2-proxy"
echo "========================================="
echo "This server provides OIDC endpoints for external authentication providers."
echo "Use with oauth2-proxy to integrate Google, GitHub, or other providers."
echo ""
echo "OIDC Endpoints Available:"
echo "  - Discovery: /.well-known/openid-configuration"
echo "  - Authorization: /oauth2/authorize"
echo "  - Token Exchange: /oauth2/token"
echo "  - User Info: /oauth2/userinfo"
echo "  - Health Check: /oauth2/health"
echo ""
echo "Deploy oauth2-proxy with this configuration:"
echo "  --provider=oidc"
echo "  --oidc-issuer-url=http://localhost:3008"
echo "  --client-id=$OIDC_CLIENT_ID"
echo "  --client-secret=$OIDC_CLIENT_SECRET"
echo "  --redirect-url=$OIDC_REDIRECT_URIS"
echo ""
echo "Standalone OTP Authentication (Optional):"
echo "  For direct email/SMS OTP without external provider:"
echo "  - Send OTP: POST /otp/send"
echo "  - Verify OTP: POST /otp/verify"
echo ""
echo "========================================="
echo "Testing OIDC Discovery (before oauth2-proxy):"
echo "========================================="
echo "curl http://localhost:3008/.well-known/openid-configuration"
echo ""
echo "========================================="
echo "Starting server..."
echo "========================================="
echo ""

npm start
