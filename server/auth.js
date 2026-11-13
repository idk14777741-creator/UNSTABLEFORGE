import crypto from 'node:crypto'

const TOKEN_TTL_SECONDS = 60 * 60 * 8

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 16) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Add a 32+ character secret to .env before starting the API.',
    )
  }
  return value
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const derived = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function signToken(user) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: issuedAt,
      exp: issuedAt + TOKEN_TTL_SECONDS,
    }),
  )
  return {
    token: `${payload}.${signature(payload)}`,
    expiresAt: new Date((issuedAt + TOKEN_TTL_SECONDS) * 1000).toISOString(),
  }
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null
  const [payload, provided] = token.split('.')
  if (!payload || !provided) return null

  const expected = signature(payload)
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!claims || typeof claims.exp !== 'number') return null
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

/**
 * Authorization middleware for organizer-only operations.
 * Expects `Authorization: Bearer <token>`.
 */
export function requireOrganizer(req, res, next) {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'A valid organizer token is required.' },
    })
  }

  const claims = verifyToken(token)
  if (!claims) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'The session is invalid or has expired.' },
    })
  }

  if (claims.role !== 'organizer' && claims.role !== 'admin') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'This account cannot manage announcements.' },
    })
  }

  req.user = claims
  return next()
}
