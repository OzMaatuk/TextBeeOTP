# PocketBase OTP Integration

This guide explains how to wire up the OTP service as the authentication flow for your private lab apps using PocketBase as the backend on your gateway device.

## How the flow works

```
User visits your app
  → app redirects to OTP login page (/login?return=<your-app-callback-url>)
  → user enters email/phone, receives OTP code
  → user enters code on /verify page
  → OTP service POSTs { token, email } to your-app-callback-url
  → your app calls /api/auth/validate to verify the token
  → your app creates a PocketBase session for the user
```

The token is a short-lived signed JWT (default 5 min). It is delivered via a POST form submission — never in a URL — so it does not appear in browser history, server logs, or Referer headers.

---

## Prerequisites

- OTP service running and reachable on your local network (e.g. `http://otp.local:3000`)
- PocketBase instance running (e.g. `http://pb.local:8090`)
- A reverse proxy (nginx, Caddy, Traefik) routing your lab apps — optional but recommended

---

## Step 1 — Configure the OTP service

Add these variables to your OTP service `.env`:

```dotenv
# Secret used to sign auth tokens — generate with: openssl rand -hex 32
AUTH_TOKEN_SECRET=your-strong-secret-here

# Token lifetime in seconds (default 300 = 5 minutes)
AUTH_TOKEN_TTL_SECONDS=300

# Allow your PocketBase callback origin
ALLOWED_ORIGINS=http://pb.local:8090,https://yourapp.yourdomain.com
```

Restart the OTP service after editing.

---

## Step 2 — Create a PocketBase hook to receive the token

PocketBase supports server-side JS hooks. Create a hook file that handles the POST callback from the OTP service and exchanges the token for a PocketBase session.

In your PocketBase `pb_hooks/` directory, create `otp_auth.pb.js`:

```js
// pb_hooks/otp_auth.pb.js

routerAdd("POST", "/api/otp-callback", (c) => {
  const body = $apis.requestInfo(c).data;
  const token = body.token;
  const email = body.email;

  if (!token || !email) {
    return c.json(400, { error: "missing_token_or_email" });
  }

  // Validate the token with the OTP service
  const res = $http.send({
    method: "GET",
    url: "http://otp.local:3000/api/auth/validate",
    headers: {
      "Authorization": "Bearer " + token,
      "X-API-Key": process.env.OTP_SERVICE_API_KEY,
    },
  });

  if (res.statusCode !== 200) {
    return c.json(401, { error: "invalid_token" });
  }

  const validated = res.json();
  if (!validated.valid || validated.email !== email) {
    return c.json(401, { error: "token_mismatch" });
  }

  // Find or create the user in PocketBase
  let record;
  try {
    record = $app.dao().findFirstRecordByData("users", "email", email);
  } catch (_) {
    // User doesn't exist yet — create them
    const collection = $app.dao().findCollectionByNameOrId("users");
    record = new Record(collection);
    record.set("email", email);
    record.set("emailVisibility", true);
    // Set a random password — user will always authenticate via OTP
    record.set("password", $security.randomString(40));
    record.set("passwordConfirm", record.get("password"));
    $app.dao().saveRecord(record);
  }

  // Issue a PocketBase auth token for the user
  const authToken = $tokens.recordAuthToken($app, record);

  return c.json(200, {
    token: authToken,
    record: record,
  });
});
```

> Note: Replace `http://otp.local:3000` with your actual OTP service address.

---

## Step 3 — Set the OTP_SERVICE_API_KEY in PocketBase's environment

PocketBase hooks can read environment variables. Add to your PocketBase startup environment:

```bash
export OTP_SERVICE_API_KEY=your-otp-service-api-key
./pocketbase serve
```

Or in your systemd unit / docker-compose:

```yaml
# docker-compose.yml (PocketBase service)
environment:
  OTP_SERVICE_API_KEY: your-otp-service-api-key
```

---

## Step 4 — Wire up your frontend app

In your frontend app, instead of showing a login form, redirect to the OTP service login page with a `return` parameter pointing to your PocketBase callback:

```js
// When the user needs to log in:
const callbackUrl = encodeURIComponent('http://pb.local:8090/api/otp-callback');
window.location.href = `http://otp.local:3000/login?return=${callbackUrl}`;
```

After the user verifies their OTP, the OTP service will POST `{ token, email }` to your callback URL. PocketBase processes it and returns a PocketBase auth token in the response body.

Your frontend receives the PocketBase token from the callback response and stores it:

```js
// In your callback handler page (if you need a client-side step):
const pbToken = responseData.token;
localStorage.setItem('pb_auth', pbToken);
// Now use pbToken in PocketBase SDK calls
```

If you're using the [PocketBase JS SDK](https://github.com/pocketbase/js-sdk), you can restore the session:

```js
import PocketBase from 'pocketbase';
const pb = new PocketBase('http://pb.local:8090');
pb.authStore.save(pbToken, responseData.record);
```

---

## Step 5 — Protect your lab apps via reverse proxy (optional but recommended)

If you use nginx or Caddy as a gateway, you can enforce that all traffic to your apps goes through the OTP flow by checking for a valid session cookie/header before proxying.

Example nginx snippet using `auth_request`:

```nginx
location /myapp/ {
    auth_request /auth-check;
    proxy_pass http://myapp.local:8080/;
}

location = /auth-check {
    internal;
    proxy_pass http://pb.local:8090/api/collections/users/auth-refresh;
    proxy_pass_request_body off;
    proxy_set_header Authorization $http_authorization;
}

# Redirect unauthenticated users to OTP login
error_page 401 = @login_redirect;
location @login_redirect {
    return 302 http://otp.local:3000/login?return=http://pb.local:8090/api/otp-callback;
}
```

---

## Token validation reference

Your backend services can also validate OTP tokens directly:

```bash
curl http://otp.local:3000/api/auth/validate \
  -H "Authorization: Bearer <token>" \
  -H "X-API-Key: your-api-key"
```

Response:

```json
{
  "valid": true,
  "email": "user@example.com",
  "sub": "user@example.com",
  "exp": 1748123456
}
```

---

## Security notes

- `AUTH_TOKEN_SECRET` must be a strong random value and kept private — it is the root of trust for all issued tokens.
- Tokens are short-lived (5 min default). After the PocketBase hook exchanges the token, it is no longer useful even if intercepted.
- The OTP service and PocketBase communicate server-to-server for token validation — the token is never re-exposed to the browser after the initial POST.
- Rate limiting on `/ui/otp/send` and `/ui/otp/verify` protects against brute force on your lab network.
