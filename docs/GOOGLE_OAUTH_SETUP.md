# Google Sign-In

The integration is implemented and tested as far as it can be without a Google
Cloud OAuth client. Until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set,
the button is not rendered anywhere and `GET /api/auth/google/start` returns 503.

## What is implemented

| Piece | Where |
| --- | --- |
| Authorization code flow | `server/oauth.js`, `/api/auth/google/start`, `/api/auth/google/callback` |
| CSRF state | HMAC-signed state + httpOnly nonce cookie, 10-minute expiry, single use |
| ID token verification | `google-auth-library` → signature via Google JWKS, issuer, audience, expiry |
| Verified email only | `email_verified === true` is required; unverified emails are refused |
| Account linking | Existing account with the same verified email is linked, never duplicated |
| Takeover protection | An account already linked to another Google subject is refused |
| Session issuance | The existing HMAC bearer token; no new session mechanism |
| Token hand-off | One-time exchange code (2-minute TTL), so no token ever appears in a URL |
| Cancellation | `error=access_denied` → `/login?google_error=cancelled` |
| Organizer safety | Google sign-in never grants `organizer`; new accounts are always `participant` |
| Rate limiting | 30 requests/minute on the OAuth endpoints, 60/minute on auth |

OAuth-only accounts store an unusable `oauth$…` marker instead of a password
hash, so password login can never succeed for them.

## What you must do (Google Cloud Console)

1. Open <https://console.cloud.google.com/> and create a project (free) —
   e.g. `unstable-forge`.
2. **APIs & Services → OAuth consent screen**
   - User type: *External*
   - App name: `UNSTABLE FORGE`
   - Support email: your address
   - Scopes: `openid`, `email`, `profile` (non-sensitive)
   - While the app is in *Testing*, add your own Google account under
     **Test users**, otherwise sign-in is blocked.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `UNSTABLE FORGE Web`
   - **Authorized JavaScript origins**
     - `http://localhost:5173` (local development)
     - `https://your-production-domain` (when deployed)
   - **Authorized redirect URIs**
     - `http://localhost:5173/api/auth/google/callback`
     - `https://your-production-domain/api/auth/google/callback`
4. Copy the client ID and client secret into `.env` (never into git):

```
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
GOOGLE_CALLBACK_URL=http://localhost:5173/api/auth/google/callback
APP_URL=http://localhost:5173
```

5. Restart the API. `GET /api/auth/providers` should return `{"google":true}`
   and the button appears on `/login` and `/signup`.

The redirect URI must match exactly, including scheme, host, port and path.
`APP_URL` determines where the callback sends the browser afterwards; the
callback URL is derived from it unless `GOOGLE_CALLBACK_URL` is set.

## Tests

`npm run test:oauth` covers state signing, expiry, tampering, cross-browser
replay, cancellation, unconfigured gating, invalid exchange codes, single-use
exchange semantics and organizer API protection (18 checks).

Not covered — and therefore not claimed as working — is a real Google round
trip, because it needs your OAuth client and a consenting Google account. Once
the credentials above are set, the check is:

1. Open `/login`, click **CONTINUE WITH GOOGLE**, sign in.
2. You land back on `/login?google_code=…`, which exchanges the code and
   redirects to your home route.
3. Signing in again with the same Google account must reuse the same user id
   (no duplicate account, registrations and projects intact).
4. A Google account whose email matches an existing password account links to
   that account; the account keeps its id and history.

## Not implemented in this pass

- Organizer second-factor verification (`organizer_grants` /
  `organizer_access_codes`) remains part of the platform milestone; organizer
  authorization is still enforced server-side from the database role.
- Participant identity claiming needs the `participants` table from the
  multi-event schema, which is not applied yet. The Google flow already
  establishes a verified email that the claim step can rely on.
