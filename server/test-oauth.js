/**
 * Google OAuth tests that do not require real Google credentials.
 *
 * Covers: CSRF state signing/expiry, cancellation handling, unconfigured
 * gating, invalid exchange codes, and single-use exchange semantics.
 *
 * A full end-to-end Google sign-in cannot run without a Google Cloud OAuth
 * client; that path is verified only when the owner supplies credentials.
 */
import crypto from 'node:crypto'
import { loadEnv } from './env.js'

loadEnv()

const BASE = process.env.API_URL || 'http://localhost:4000'
let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const {
  createState,
  verifyState,
  createExchange,
  consumeExchange,
  googleConfig,
} = await import('./oauth.js')

async function main() {
  console.log('\nState / CSRF')

  const { state, nonce } = createState()
  check('a freshly created state verifies', verifyState(state, nonce))
  check('a state from another browser is rejected', !verifyState(state, 'other-nonce'))
  check('an unsigned state is rejected', !verifyState('abc.def', nonce))
  check(
    'a tampered signature is rejected',
    !verifyState(`${state.slice(0, -1)}${state.endsWith('a') ? 'b' : 'a'}`, nonce),
  )

  const oldIssued = Date.now() - 11 * 60 * 1000
  const oldNonce = 'expired-nonce'
  const oldSignature = crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(`google:${oldNonce}:${oldIssued}`)
    .digest('base64url')
  check(
    'a state older than ten minutes is rejected',
    !verifyState(`${oldNonce}.${oldIssued}.${oldSignature}`, oldNonce),
  )

  console.log('\nExchange hand-off')

  const exchangeCode = createExchange({
    token: 'test-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: { id: 1, email: 'test@example.test', role: 'participant' },
  })
  check('an exchange code can be consumed once', Boolean(consumeExchange(exchangeCode)))
  check('an exchange code cannot be reused', consumeExchange(exchangeCode) === null)
  check('an unknown exchange code is refused', consumeExchange('not-a-real-code') === null)

  console.log('\nConfiguration')

  const config = googleConfig()
  check(
    'credentials are reported as configured only when both values exist',
    config.enabled === Boolean(config.clientId && config.clientSecret),
  )
  check(
    'callback URL defaults to the app origin',
    config.callbackUrl.endsWith('/api/auth/google/callback'),
  )

  console.log('\nHTTP surface')

  const providers = await fetch(`${BASE}/api/auth/providers`)
  const providersBody = await providers.json()
  check('providers endpoint answers', providers.status === 200)
  check('google availability matches configuration', providersBody.google === config.enabled)

  if (!config.enabled) {
    const start = await fetch(`${BASE}/api/auth/google/start`, { redirect: 'manual' })
    check('start refuses cleanly when unconfigured', start.status === 503)
  }

  const badState = await fetch(
    `${BASE}/api/auth/google/callback?code=abc&state=forged.nonce.sig`,
    { redirect: 'manual' },
  )
  const badStateLocation = badState.headers.get('location') || ''
  check('callback with a forged state redirects to an error', badState.status === 302)
  check(
    'forged state is reported as a state failure',
    badStateLocation.includes('google_error=state'),
    badStateLocation,
  )

  const cancelled = await fetch(
    `${BASE}/api/auth/google/callback?error=access_denied&state=anything`,
    { redirect: 'manual' },
  )
  check(
    'cancelled consent is reported as cancelled',
    (cancelled.headers.get('location') || '').includes('google_error=cancelled'),
  )

  const invalidExchange = await fetch(`${BASE}/api/auth/google/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'invalid' }),
  })
  check('an invalid exchange code is rejected', invalidExchange.status === 400)

  const unauthorised = await fetch(`${BASE}/api/admin/announcements`)
  check('organizer API still requires a token', unauthorised.status === 401)

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
