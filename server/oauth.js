/**
 * Google Sign-In — authorization code flow with server-side ID token
 * verification.
 *
 * The browser never supplies an identity. It only returns an authorization
 * code; the exchange and the ID token verification happen here, and the
 * verified `sub` + email are what identify the account.
 *
 * Required environment:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   APP_URL               (public origin; used to derive the callback)
 *   GOOGLE_CALLBACK_URL   (optional explicit override)
 */
import crypto from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'

const STATE_TTL_MS = 10 * 60 * 1000
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = ['openid', 'email', 'profile']

export function googleConfig() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
  const callbackUrl = (
    process.env.GOOGLE_CALLBACK_URL || `${appUrl}/api/auth/google/callback`
  ).trim()

  return {
    clientId,
    clientSecret,
    appUrl,
    callbackUrl,
    enabled: Boolean(clientId && clientSecret),
  }
}

function signState(nonce, issuedAt) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required to sign OAuth state.')
  return crypto
    .createHmac('sha256', secret)
    .update(`google:${nonce}:${issuedAt}`)
    .digest('base64url')
}

/**
 * Creates a signed, single-use CSRF state. The nonce is also stored in an
 * httpOnly cookie, so a state parameter replayed from another browser fails.
 */
export function createState() {
  const nonce = crypto.randomBytes(24).toString('base64url')
  const issuedAt = Date.now()
  const state = `${nonce}.${issuedAt}.${signState(nonce, issuedAt)}`
  return { state, nonce, maxAge: STATE_TTL_MS }
}

export function verifyState(state, cookieNonce) {
  if (typeof state !== 'string' || typeof cookieNonce !== 'string') return false
  const parts = state.split('.')
  if (parts.length !== 3) return false

  const [nonce, issuedAt, signature] = parts
  if (nonce !== cookieNonce) return false

  const issued = Number(issuedAt)
  if (!Number.isFinite(issued) || Date.now() - issued > STATE_TTL_MS) return false

  const expected = signState(nonce, issuedAt)
  const provided = Buffer.from(signature)
  const intended = Buffer.from(expected)
  if (provided.length !== intended.length) return false
  return crypto.timingSafeEqual(provided, intended)
}

export function authorizationUrl(state) {
  const { clientId, callbackUrl } = googleConfig()
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', callbackUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')
  url.searchParams.set('include_granted_scopes', 'true')
  return url.toString()
}

function oauthClient({ clientId, clientSecret, callbackUrl }) {
  return new OAuth2Client({ clientId, clientSecret, redirectUri: callbackUrl })
}

/**
 * Exchanges an authorization code and verifies the resulting ID token.
 *
 * `verifyIdToken` checks the signature against Google's published keys, plus
 * issuer, audience and expiry, so only the claims we act on are re-checked
 * here. Throws on any failure — callers must not trust partial data.
 */
export async function exchangeCode(code) {
  const config = googleConfig()
  if (!config.enabled) throw new Error('Google sign-in is not configured.')

  const oauth = oauthClient(config)
  const { tokens } = await oauth.getToken({ code, redirect_uri: config.callbackUrl })
  if (!tokens?.id_token) throw new Error('Google did not return an ID token.')

  const ticket = await oauth.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.clientId,
  })
  const payload = ticket.getPayload()
  if (!payload) throw new Error('Google ID token payload was empty.')

  if (!payload.sub || !payload.email) throw new Error('Google account is missing an email.')
  if (payload.email_verified !== true) {
    throw new Error('This Google account has no verified email address.')
  }

  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  }
}

/**
 * Short-lived, single-use hand-off from the OAuth redirect back to the SPA.
 * Kept in memory: the exchange happens within seconds of the redirect, and a
 * process restart simply means the user signs in again.
 */
const exchanges = new Map()
const EXCHANGE_TTL_MS = 2 * 60 * 1000

export function createExchange(session) {
  const code = crypto.randomBytes(32).toString('base64url')
  exchanges.set(code, { ...session, expiresAt: Date.now() + EXCHANGE_TTL_MS })

  for (const [key, value] of exchanges) {
    if (value.expiresAt <= Date.now()) exchanges.delete(key)
  }

  return code
}

export function consumeExchange(code) {
  if (typeof code !== 'string') return null
  const entry = exchanges.get(code)
  if (!entry) return null
  exchanges.delete(code)
  if (entry.expiresAt <= Date.now()) return null
  return entry
}
