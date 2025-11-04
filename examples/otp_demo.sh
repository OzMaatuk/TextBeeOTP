#!/usr/bin/env bash
set -euo pipefail

# Load .env if present (safe export)
if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

BASE_URL="${BASE_URL:-http://localhost:3008}"

send_sms() {
  local phone="${1:-+15555550123}"
  echo "Sending SMS OTP to ${phone}"
  curl -sS -X POST "$BASE_URL/otp/send" \
    -H "Content-Type: application/json" \
    -d "{\"recipient\": \"$phone\", \"channel\": \"sms\"}"
  echo
}

send_email() {
  local email="${1:-user@example.com}"
  echo "Sending Email OTP to ${email}"
  curl -sS -X POST "$BASE_URL/otp/send" \
    -H "Content-Type: application/json" \
    -d "{\"recipient\": \"$email\", \"channel\": \"email\"}"
  echo
}

verify() {
  local recipient="$1"; shift
  local code="$1"; shift
  echo "Verifying OTP for ${recipient} with code ${code}"
  curl -sS -X POST "$BASE_URL/otp/verify" \
    -H "Content-Type: application/json" \
    -d "{\"recipient\": \"$recipient\", \"code\": \"$code\"}"
  echo
}

cat <<USAGE
Usage:
  ./examples/otp_demo.sh send-sms <phone>
  ./examples/otp_demo.sh send-email <email>
  ./examples/otp_demo.sh verify <recipient> <code>

Notes:
- Ensure server is running (npm run dev) and .env is configured.
- For dev without provider keys, SMS/Email are logged to console.
USAGE

cmd="${1:-}"; shift || true
case "$cmd" in
  send-sms) send_sms "$@" ;;
  send-email) send_email "$@" ;;
  verify) verify "$@" ;;
  *) exit 0 ;;
esac


