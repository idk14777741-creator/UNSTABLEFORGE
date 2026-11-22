/**
 * Shared platform helpers: event serialisation, capacity, passes and auditing.
 *
 * Everything here is engine-agnostic plain SQL through the driver facade.
 */
import crypto from 'node:crypto'

export const EVENT_TYPES = ['hackathon', 'debate', 'seminar', 'workshop', 'competition', 'other']
export const LIFECYCLES = [
  'draft',
  'upcoming',
  'registration_open',
  'registration_closed',
  'ongoing',
  'completed',
  'archived',
]
export const REGISTRATION_STATUSES = [
  'registered',
  'pending_payment',
  'payment_submitted',
  'verification_pending',
  'confirmed',
  'cancelled',
  'rejected',
  'refunded',
]
export const CONTENT_KINDS = {
  domains: 'event_domains',
  topics: 'event_topics',
  rules: 'event_rules',
  criteria: 'event_criteria',
  faqs: 'event_faqs',
}

/** Statuses that occupy a seat against the event's participant capacity. */
export const SEAT_HOLDING = [
  'pending_payment',
  'payment_submitted',
  'verification_pending',
  'confirmed',
  'registered',
]

export function passToken(pass) {
  return crypto
    .createHmac('sha256', process.env.AUTH_SECRET)
    .update(`pass:${pass.id}:${pass.registration_id}`)
    .digest('base64url')
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function passPayload(pass) {
  return { id: pass.id, token: passToken(pass), revokedAt: pass.revoked_at }
}

export function serializeEvent(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    tagline: row.tagline,
    shortDescription: row.short_description,
    description: row.description,
    type: row.event_type,
    lifecycle: row.lifecycle,
    isPublished: Boolean(row.is_published),
    registrationOpen: Boolean(row.registration_open),
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    organizer: row.organizer_name ? { name: row.organizer_name, email: row.organizer_email } : null,
    coverUrl: row.cover_url ?? null,
    heroUrl: row.hero_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  }
}

export function serializeSettings(row, usage = {}) {
  if (!row) return null
  const capacity = row.capacity ?? null
  const seatsTaken = Number(usage.seats_taken ?? 0)
  return {
    enabled: Boolean(row.enabled),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isPaid: Boolean(row.is_paid),
    feeMinor: row.fee_minor,
    feeUnit: row.fee_unit,
    feeLabel: `₹${(row.fee_minor / 100).toLocaleString('en-IN')}`,
    currency: row.currency,
    capacity,
    inventoryUnit: row.inventory_unit,
    seatsTaken,
    seatsRemaining: capacity === null ? null : Math.max(0, capacity - seatsTaken),
    registrationMode: row.registration_mode,
    minTeamSize: row.min_team_size,
    maxTeamSize: row.max_team_size,
    pendingHoldMinutes: row.pending_hold_minutes,
    paymentInstructions: row.payment_instructions,
    paymentQrUrl: row.payment_qr_url ?? null,
  }
}

/**
 * Seats currently held for an event, counted by individual participant — a
 * team of four consumes four places. Expired pending holds are excluded, so an
 * abandoned payment never blocks the event forever.
 */
export async function seatUsage(db, eventId) {
  const row = await db.get(
    `SELECT COUNT(*) AS seats_taken
       FROM registrations
      WHERE event_id = ?
        AND status IN (${SEAT_HOLDING.map(() => '?').join(', ')})
        AND (hold_expires_at IS NULL OR hold_expires_at > ?)`,
    [eventId, ...SEAT_HOLDING, new Date().toISOString()],
  )
  return Number(row?.seats_taken ?? 0)
}

export async function audit(db, req, { action, entityType, entityId = null, eventId = null, metadata = {} }) {
  try {
    await db.run(
      `INSERT INTO audit_logs
         (actor_user_id, event_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req?.user?.sub ?? null,
        eventId,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        JSON.stringify(metadata),
        req?.ip ?? null,
      ],
    )
  } catch (error) {
    // An audit failure must be visible but must not roll back the action itself.
    console.error('[audit] failed to record', action, error.message)
  }
}

/** Creates the pass row if needed and returns the derived, displayable token. */
export async function ensurePass(db, registration) {
  const existing = await db.get('SELECT * FROM passes WHERE registration_id = ?', [registration.id])
  if (existing) return { ...existing, token: passToken(existing) }

  const created = await db.run(
    `INSERT INTO passes (registration_id, event_id, token_hash, token_prefix)
     VALUES (?, ?, ?, ?)`,
    [registration.id, registration.event_id, `pending-${crypto.randomUUID()}`, 'UF-PASS'],
  )

  const pass = await db.get('SELECT * FROM passes WHERE id = ?', [created.id])
  const token = passToken(pass)

  await db.run('UPDATE passes SET token_hash = ?, token_prefix = ? WHERE id = ?', [
    hashToken(token),
    token.slice(0, 8),
    pass.id,
  ])

  return { ...pass, token_hash: hashToken(token), token }
}

export function requirePlatform(db) {
  return (req, res, next) => {
    if (!db.platform) {
      return res.status(503).json({
        error: {
          code: 'PLATFORM_UNAVAILABLE',
          message:
            'Multi-event features require PostgreSQL. Set DATABASE_URL and restart the API.',
        },
      })
    }
    return next()
  }
}
