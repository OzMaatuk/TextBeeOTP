#!/bin/bash

# TextBeeOTP with Login UI - Demo
# This script starts the OTP service with the browser-based login UI

echo "========================================="
echo "TextBeeOTP - Login UI Demo"
echo "========================================="
echo ""
echo "Starting server..."
echo ""

# Set required environment variables
export NODE_ENV=development
export PORT=${PORT:-3008}
export OTP_TTL_SECONDS=${OTP_TTL_SECONDS:-300}
export OTP_LENGTH=${OTP_LENGTH:-6}
export OTP_SECRET=${OTP_SECRET:-demo-secret-for-testing-only}

# Optional: Configure email provider
export EMAIL_FROM=${EMAIL_FROM:-noreply@example.com}
export SMTP_HOST=${SMTP_HOST:-smtp.ethereal.email}
export SMTP_PORT=${SMTP_PORT:-587}
export SMTP_SECURE=${SMTP_SECURE:-false}
export SMTP_USER=${SMTP_USER:-demo@ethereal.email}
export SMTP_PASS=${SMTP_PASS:-demo-password}

# Optional: Configure SMS provider (not required for email-only demo)
# export TEXTBEE_API_KEY=your-api-key
# export TEXTBEE_DEVICE_ID=your-device-id

npm run build
npm start &

sleep 2

echo ""
echo "========================================="
echo "✓ Server started on http://localhost:${PORT}"
echo "========================================="
echo ""
echo "Access the login UI:"
echo "   http://localhost:${PORT}/login"
echo ""
echo "API Endpoints (if you prefer direct API calls):"
echo "   POST /otp/send - Send OTP code"
echo "   POST /otp/verify - Verify OTP code"
echo ""
echo "API Documentation:"
echo "   http://localhost:${PORT}/api-docs"
echo ""
echo "Health Check:"
echo "   http://localhost:${PORT}/health"
echo ""
echo "========================================="
echo ""
echo "To stop the server, press Ctrl+C"
echo ""

# Wait for the process to finish
wait
