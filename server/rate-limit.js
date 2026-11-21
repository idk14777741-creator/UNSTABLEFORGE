/**
 * Minimal in-memory rate limiter for authentication endpoints.
 *
 * Fixed window keyed by client IP. Adequate for a single-process deployment;
 * a multi-instance deployment should move this to Redis or the database.
 */
const buckets = new Map()

export function rateLimit({ windowMs = 60_000, max = 20, name = 'default' } = {}) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'unknown'}`
    const now = Date.now()
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    bucket.count += 1
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Too many attempts. Try again in ${retryAfter} seconds.`,
        },
      })
    }

    return next()
  }
}

// Housekeeping so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000).unref?.()
