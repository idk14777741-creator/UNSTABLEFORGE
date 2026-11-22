/**
 * UNSTABLE FORGE — platform API.
 *
 * A configurable multi-event engine: events, their content modules, captain-led
 * team registration with participant-based capacity, manual UPI payments, QR
 * entry passes, check-in, certificates and The Glimpse media.
 *
 * Conventions match the rest of the API: `{ data }` on success, `{ error: {
 * code, message, fields? } }` on failure, `?` placeholders through the driver.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { hashPassword, verifyPassword, signToken, requireAuth, requireOrganizer } from '../auth.js'
import { rateLimit } from '../rate-limit.js'
import {
  CONTENT_KINDS,
  EVENT_TYPES,
  LIFECYCLES,
  SEAT_HOLDING,
  audit,
  ensurePass,
  hashToken,
  passToken,
  requirePlatform,
  seatUsage,
  serializeEvent,
  serializeSettings,
} from './elements.js'
import { renderCertificatePdf } from './pdf.js'
import { mailConfig } from '../mail.js'
import {
  createOrder,
  fetchPayment,
  razorpayConfig,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../payments.js'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const mediaDir = () => process.env.MEDIA_DIR || path.resolve(process.cwd(), 'server/data/uploads')
/**
 * PostgreSQL is the only engine that keeps media bytes, because it is the only
 * one used on a host whose filesystem does not survive a restart.
 */
const keepsMediaBlobs = (db) => db.engine === 'postgres'
const now = () => new Date().toISOString()

const EVENT_SELECT = `
  SELECT e.*, cover.url AS cover_url, hero.url AS hero_url,
         (SELECT COUNT(*) FROM registrations r
           WHERE r.event_id = e.id
             AND r.status IN (${SEAT_HOLDING.map(() => '?').join(', ')})
             AND (r.hold_expires_at IS NULL OR r.hold_expires_at > ?)) AS seats_taken
    FROM events e
    LEFT JOIN media_assets cover ON cover.id = e.cover_asset_id
    LEFT JOIN media_assets hero ON hero.id = e.hero_asset_id`
const eventParams = () => [...SEAT_HOLDING, now()]

const SETTINGS_SELECT = `
  SELECT s.*, qr.url AS payment_qr_url
    FROM event_registration_settings s
    LEFT JOIN media_assets qr ON qr.id = s.payment_qr_asset_id
   WHERE s.event_id = ?`

class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

const fail = (status, code, message, fields) => new HttpError(status, code, message, fields)

const clean = (value, max = 2000) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''

const text = (value, max = 20000) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function parseId(value) {
  return /^\d+$/.test(String(value)) ? Number(value) : null
}

export function registerPlatformRoutes(app, { db }) {
  const platform = requirePlatform(db)
  const writingLimit = rateLimit({ name: 'platform-write', windowMs: 60_000, max: 60 })

  // ------------------------------------------------------------ authorization

  // The token's role claim is not trusted on its own: the account must also
  // hold an active organizer grant in the database.
  const requireGrant = async (req, res, next) => {
    const grant = await db.get(
      'SELECT user_id FROM organizer_grants WHERE user_id = ? AND revoked_at IS NULL',
      [Number(req.user.sub)],
    )
    if (!grant && req.user.role !== 'admin') {
      throw fail(403, 'FORBIDDEN', 'This account is not an authorized organizer.')
    }
    next()
  }

  // Important actions additionally need the personal access code to have been
  // verified in this session.
  const requireElevated = (req, res, next) => {
    if (req.user.org !== true) {
      throw fail(
        403,
        'ORGANIZER_VERIFICATION_REQUIRED',
        'Confirm your organizer access code before performing this action.',
      )
    }
    next()
  }

  const organizer = [requireOrganizer, requireGrant]

  /**
   * Confirms a gateway payment exactly once and issues every team pass.
   * Called by the browser-success route after signature + status verification,
   * and by the webhook after signature verification. Both paths share the same
   * lock, so a captured payment can never confirm a registration twice.
   */
  async function confirmGatewayPayment(
    paymentId,
    { providerPaymentId, providerSignature = null, payload = null, amountMinor = null },
  ) {
    return db.withTransaction(async (trx) => {
      await trx.get('SELECT id FROM payments WHERE id = ? FOR UPDATE', [paymentId])
      const payment = await trx.get('SELECT * FROM payments WHERE id = ?', [paymentId])
      if (!payment) throw fail(404, 'NOT_FOUND', 'Payment not found.')

      if (payment.status === 'verified') {
        return { alreadyConfirmed: true, payment, registrations: [] }
      }
      if (payment.status === 'refunded') {
        throw fail(409, 'PAYMENT_REFUNDED', 'This payment has already been refunded.')
      }
      if (amountMinor !== null && Number(amountMinor) !== Number(payment.amount_minor)) {
        throw fail(409, 'AMOUNT_MISMATCH', 'The gateway amount does not match the order.')
      }
      if (
        payment.provider_payment_id &&
        providerPaymentId &&
        payment.provider_payment_id !== providerPaymentId
      ) {
        throw fail(409, 'PAYMENT_CONFLICT', 'A different payment is already recorded for this order.')
      }

      await trx.run(
        `UPDATE payments
            SET status = 'verified', provider = 'razorpay', provider_payment_id = ?,
                provider_signature = ?, provider_payload = ?, paid_at = ?, verified_at = ?,
                rejection_reason = NULL, updated_at = ?
          WHERE id = ?`,
        [
          providerPaymentId || null,
          providerSignature,
          payload === null ? null : JSON.stringify(payload),
          now(),
          now(),
          now(),
          payment.id,
        ],
      )

      await trx.run(
        `UPDATE registrations
            SET status = 'confirmed', hold_expires_at = NULL, confirmed_at = ?, updated_at = ?
          WHERE payment_id = ?
            AND status IN ('pending_payment', 'payment_submitted', 'verification_pending', 'rejected')`,
        [now(), now(), payment.id],
      )

      const registrations = await trx.all(
        'SELECT id, event_id FROM registrations WHERE payment_id = ? ORDER BY id',
        [payment.id],
      )
      for (const registration of registrations) {
        await ensurePass(trx, registration)
      }

      return { alreadyConfirmed: false, payment, registrations }
    })
  }

  /**
   * Records a payment the gateway has accepted but not captured. Nothing is
   * confirmed: this only makes the pending payment visible, so a second
   * checkout cannot be opened for the same seat while the first is still
   * capturable. Confirmation still happens exclusively on capture.
   */
  async function recordAuthorizedPayment(paymentId, remote) {
    await db.run(
      `UPDATE payments
          SET provider = 'razorpay',
              provider_payment_id = COALESCE(provider_payment_id, ?),
              provider_payload = ?, updated_at = ?
        WHERE id = ? AND status <> 'verified'`,
      [remote.id, JSON.stringify(remote), now(), paymentId],
    )
  }

  async function platformSettings() {
    const row = await db.get('SELECT * FROM platform_settings WHERE id = 1')
    return { eventDiscoveryEnabled: row ? row.event_discovery_enabled !== false : true }
  }

  // ------------------------------------------------------------------- events

  app.get('/api/events', platform, async (req, res) => {
    // Discovery is a platform-wide switch, separate from each event's own
    // publication state. Turning it off hides the list; nothing is deleted.
    if (!(await platformSettings()).eventDiscoveryEnabled) {
      return res.json({ data: [], meta: { discovery: false } })
    }

    const scope = ['upcoming', 'past', 'all'].includes(req.query.scope) ? req.query.scope : 'upcoming'
    const lifecycleFilter =
      scope === 'past'
        ? "e.lifecycle IN ('completed', 'archived')"
        : scope === 'all'
          ? "e.lifecycle <> 'draft'"
          : "e.lifecycle NOT IN ('draft', 'completed', 'archived')"

    const rows = await db.all(
      `${EVENT_SELECT}
        WHERE e.is_published = TRUE AND ${lifecycleFilter}
        ORDER BY e.starts_at NULLS LAST, e.id`,
      eventParams(),
    )

    res.json({
      data: rows.map((row) => ({ ...serializeEvent(row), seatsTaken: Number(row.seats_taken) })),
      meta: { discovery: true },
    })
  })

  app.get('/api/events/:slug', platform, async (req, res) => {
    const row = await db.get(`${EVENT_SELECT} WHERE e.slug = ?`, [...eventParams(), req.params.slug])

    if (!row || !row.is_published) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    const [settings, domains, topics, rules, criteria, faqs, speakers, sessions, glimpse, customFields] =
      await Promise.all([
        db.get(SETTINGS_SELECT, [row.id]),
        db.all('SELECT * FROM event_domains WHERE event_id = ? ORDER BY sort_order, id', [row.id]),
        db.all('SELECT * FROM event_topics WHERE event_id = ? ORDER BY sort_order, id', [row.id]),
        db.all('SELECT * FROM event_rules WHERE event_id = ? ORDER BY section, sort_order, id', [row.id]),
        db.all('SELECT * FROM event_criteria WHERE event_id = ? ORDER BY sort_order, id', [row.id]),
        db.all(
          'SELECT * FROM event_faqs WHERE event_id = ? AND is_published = TRUE ORDER BY sort_order, id',
          [row.id],
        ),
        db.all(
          `SELECT s.*, es.sort_order FROM event_speakers es
             JOIN speakers s ON s.id = es.speaker_id
            WHERE es.event_id = ? ORDER BY es.sort_order, s.id`,
          [row.id],
        ),
        db.all(
          `SELECT s.*, sp.name AS speaker_name FROM event_sessions s
             LEFT JOIN speakers sp ON sp.id = s.speaker_id
            WHERE s.event_id = ? ORDER BY s.sort_order, s.starts_at NULLS LAST, s.id`,
          [row.id],
        ),
        db.all(
          `SELECT * FROM media_assets
            WHERE event_id = ? AND placement = 'glimpse' AND is_published = TRUE
            ORDER BY sort_order, id`,
          [row.id],
        ),
        db.all('SELECT * FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order, id', [
          row.id,
        ]),
      ])

    res.json({
      data: {
        ...serializeEvent(row),
        seatsTaken: Number(row.seats_taken),
        settings: serializeSettings(settings, { seats_taken: row.seats_taken }),
        content: {
          domains: domains.map((item) => ({ id: item.id, title: item.title, description: item.description })),
          topics: topics.map((item) => ({ id: item.id, title: item.title, description: item.description })),
          rules: rules.map((item) => ({
            id: item.id,
            section: item.section,
            title: item.title,
            body: item.body,
          })),
          criteria: criteria.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            weight: item.weight,
          })),
          faqs: faqs.map((item) => ({ id: item.id, question: item.question, answer: item.answer })),
          speakers: speakers.map((item) => ({
            id: item.id,
            name: item.name,
            title: item.title,
            organization: item.organization,
            bio: item.bio,
            profileUrl: item.profile_url,
            photoUrl: null,
          })),
          sessions: sessions.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            speakerId: item.speaker_id,
            speakerName: item.speaker_name,
            startsAt: item.starts_at,
            endsAt: item.ends_at,
            venue: item.venue,
          })),
          registrationFields: customFields.map((item) => ({
            key: item.field_key,
            label: item.label,
            type: item.field_type,
            options: item.options,
            required: item.is_required,
          })),
        },
        glimpse: glimpse.map((item) => ({
          id: item.id,
          url: item.url,
          caption: item.caption,
          credit: item.credit,
          alt: item.alt_text,
          isFeatured: Boolean(item.is_featured),
          width: item.width,
          height: item.height,
        })),
      },
    })
  })

  app.get('/api/glimpse', platform, async (req, res) => {
    const eventSlug = typeof req.query.event === 'string' ? req.query.event : null
    const rows = await db.all(
      `SELECT m.*, e.slug AS event_slug, e.name AS event_name
         FROM media_assets m
         LEFT JOIN events e ON e.id = m.event_id
        WHERE m.placement = 'glimpse' AND m.is_published = TRUE
          ${eventSlug === null ? '' : 'AND e.slug = ?'}
        ORDER BY m.is_featured DESC, m.sort_order, m.id`,
      eventSlug === null ? [] : [eventSlug],
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        url: row.url,
        caption: row.caption,
        credit: row.credit,
        alt: row.alt_text,
        isFeatured: Boolean(row.is_featured),
        eventSlug: row.event_slug,
        eventName: row.event_name,
        width: row.width,
        height: row.height,
      })),
    })
  })

  // ------------------------------------------------------- participant journey

  app.get('/api/me/dashboard', platform, requireAuth, async (req, res) => {
    const userId = Number(req.user.sub)

    const registrations = await db.all(
      `SELECT r.*, e.slug AS event_slug, e.name AS event_name, e.event_type, e.lifecycle,
              e.starts_at, e.ends_at, e.is_published,
              p.status AS payment_status, p.amount_minor, p.currency, p.transaction_ref,
              t.name AS team_name,
              (SELECT COUNT(*) FROM check_ins c WHERE c.pass_id = ps.id AND c.reverted_at IS NULL) AS checked_in
         FROM registrations r
         JOIN participants pt ON pt.id = r.participant_id
         JOIN events e ON e.id = r.event_id
         LEFT JOIN payments p ON p.id = r.payment_id
         LEFT JOIN teams t ON t.id = r.team_id
         LEFT JOIN passes ps ON ps.registration_id = r.id
        WHERE pt.user_id = ?
        ORDER BY r.created_at DESC`,
      [userId],
    )

    const passes = await db.all(
      `SELECT ps.*, r.reference, r.status AS registration_status,
              e.slug AS event_slug, e.name AS event_name, e.starts_at
         FROM passes ps
         JOIN registrations r ON r.id = ps.registration_id
         JOIN participants pt ON pt.id = r.participant_id
         JOIN events e ON e.id = ps.event_id
        WHERE pt.user_id = ? AND ps.revoked_at IS NULL AND r.status = 'confirmed'`,
      [userId],
    )

    const certificates = await db.all(
      `SELECT c.*, e.slug AS event_slug, e.name AS event_name
         FROM certificates c
         JOIN registrations r ON r.id = c.registration_id
         JOIN participants pt ON pt.id = r.participant_id
         JOIN events e ON e.id = c.event_id
        WHERE pt.user_id = ?
        ORDER BY c.issued_at DESC`,
      [userId],
    )

    const profile = await db.get(
      'SELECT id, email, role, display_name, email_verified_at, created_at FROM users WHERE id = ?',
      [userId],
    )

    res.json({
      data: {
        profile: profile
          ? {
              id: profile.id,
              email: profile.email,
              role: profile.role,
              displayName: profile.display_name,
              emailVerified: Boolean(profile.email_verified_at),
              memberSince: profile.created_at,
            }
          : null,
        registrations: registrations.map((row) => ({
          id: row.id,
          reference: row.reference,
          eventSlug: row.event_slug,
          eventTitle: row.event_name,
          eventType: row.event_type,
          lifecycle: row.lifecycle,
          startsAt: row.starts_at,
          status: row.status,
          isCaptain: Boolean(row.is_captain),
          teamName: row.team_name,
          payment: row.payment_status
            ? {
                status: row.payment_status,
                amountMinor: row.amount_minor,
                currency: row.currency,
                transactionRef: row.transaction_ref,
              }
            : null,
          checkedIn: Number(row.checked_in) > 0,
          createdAt: row.created_at,
        })),
        passes: passes.map((row) => ({
          id: row.id,
          token: passToken(row),
          reference: row.reference,
          eventSlug: row.event_slug,
          eventTitle: row.event_name,
          startsAt: row.starts_at,
          issuedAt: row.issued_at,
        })),
        certificates: certificates.map((row) => ({
          id: row.id,
          code: row.verification_code,
          certificateNo: row.certificate_no,
          title: row.title,
          kind: row.kind,
          rankPosition: row.rank_position,
          eventSlug: row.event_slug,
          eventTitle: row.event_name,
          issuedAt: row.issued_at,
          revoked: Boolean(row.revoked_at),
        })),
      },
    })
  })

  /** Links participant records to a verified account with the same email. */
  app.post('/api/auth/claim', platform, requireAuth, async (req, res) => {
    const userId = Number(req.user.sub)
    const user = await db.get('SELECT id, email, email_verified_at FROM users WHERE id = ?', [userId])
    if (!user || !user.email_verified_at) {
      return res.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message:
            'Sign in with Google (or verify your email) before claiming participation records.',
        },
      })
    }

    const claimed = await claimParticipations(db, user)
    res.json({ data: { claimed } })
  })

  // -------------------------------------------------------------- registration

  app.post('/api/events/:slug/register', platform, requireAuth, writingLimit, async (req, res) => {
    const eventRow = await db.get('SELECT * FROM events WHERE slug = ?', [req.params.slug])
    if (!eventRow) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    const settings = await db.get(SETTINGS_SELECT, [eventRow.id])
    ensureRegistrationWindow(eventRow, settings)

    const body = req.body || {}
    const members = validateMembers(body, settings, req.user.email)
    const customFields = await validateCustomFields(db, eventRow.id, body.customFields)
    const teamName =
      members.length > 1 || settings.registration_mode !== 'individual'
        ? clean(body.teamName, 80) || `${members[0].fullName}`
        : null

    if (members.length > 1 && !clean(body.teamName, 80)) {
      throw fail(400, 'VALIDATION_ERROR', 'A team name is required for team registration.', {
        teamName: 'Enter a team name.',
      })
    }

    const feeMinor = settings.is_paid
      ? settings.fee_unit === 'participant'
        ? settings.fee_minor * members.length
        : settings.fee_minor
      : 0

    let registration
    try {
      registration = await db.withTransaction(async (trx) => {
      // Locking the settings row serialises concurrent registrations for this
      // event, so the capacity check below cannot be raced.
      await trx.get('SELECT event_id FROM event_registration_settings WHERE event_id = ? FOR UPDATE', [
        eventRow.id,
      ])

      const taken = await seatUsage(trx, eventRow.id)
      if (settings.capacity !== null && taken + members.length > settings.capacity) {
        throw fail(
          409,
          'CAPACITY_REACHED',
          `Only ${Math.max(0, settings.capacity - taken)} participant place(s) remain for this event.`,
        )
      }

      const captainUser = await trx.get('SELECT id, email, email_verified_at, display_name FROM users WHERE id = ?', [
        Number(req.user.sub),
      ])

      // Participant records exist before the team, because the team's captain
      // is a participant, not an account.
      const participants = []
      for (const [index, member] of members.entries()) {
        const isCaptain = index === 0
        participants.push(
          await upsertParticipant(trx, member, {
            userId: isCaptain ? captainUser.id : null,
            verified: isCaptain,
          }),
        )
      }

      let teamId = null
      if (members.length > 1) {
        const team = await trx.run(
          'INSERT INTO teams (event_id, name, captain_participant_id, created_at) VALUES (?, ?, ?, ?)',
          [eventRow.id, teamName, participants[0].id, now()],
        )
        teamId = team.id
      }

      const holdUntil = new Date(Date.now() + settings.pending_hold_minutes * 60_000).toISOString()
      const status = settings.is_paid ? 'pending_payment' : 'confirmed'

      const payment = settings.is_paid
        ? await trx.run(
            `INSERT INTO payments (event_id, team_id, amount_minor, currency, method, status, submitted_by)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [eventRow.id, teamId, feeMinor, settings.currency, 'upi_qr', Number(req.user.sub)],
          )
        : null

      const created = []
      for (const [index, member] of members.entries()) {
        const isCaptain = index === 0
        const participant = participants[index]

        const inserted = await trx.run(
          `INSERT INTO registrations
             (event_id, user_id, full_name, campus, created_at, participant_id, team_id,
              payment_id, is_captain, status, seats, hold_expires_at, confirmed_at,
              custom_fields, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [
            eventRow.id,
            isCaptain ? captainUser.id : null,
            member.fullName,
            member.campus || '',
            now(),
            participant.id,
            teamId,
            payment?.id ?? null,
            isCaptain,
            status,
            settings.is_paid ? holdUntil : null,
            settings.is_paid ? null : now(),
            JSON.stringify(customFields),
            now(),
          ],
        )

        await trx.run('UPDATE registrations SET reference = ? WHERE id = ?', [
          `UF-${eventRow.id}-${String(inserted.id).padStart(5, '0')}`,
          inserted.id,
        ])

        // A free registration is confirmed immediately, so it gets its entry
        // pass at registration time. Paid events issue passes on verification.
        if (!settings.is_paid) {
          await ensurePass(trx, { id: inserted.id, event_id: eventRow.id })
        }

        created.push({ id: inserted.id, reference: `UF-${eventRow.id}-${String(inserted.id).padStart(5, '0')}` })
      }

      return {
        reference: created[0].reference,
        status,
        teamName,
        members: created,
        payment: payment
          ? { id: payment.id, amountMinor: feeMinor, currency: settings.currency, status: 'pending' }
          : null,
        settings: serializeSettings(settings),
      }
      })
    } catch (error) {
      // A repeated captain, or a team name already used for this event, is a
      // conflict rather than a server failure.
      if (String(error?.code) === '23505') {
        throw fail(409, 'REGISTRATION_EXISTS', 'That registration or team name already exists.')
      }
      throw error
    }

    await audit(db, req, {
      action: 'registration.create',
      entityType: 'registration',
      entityId: registration.reference,
      eventId: eventRow.id,
      metadata: { teamName, members: members.length, status: registration.status },
    })

    res.status(201).json({ data: registration })
  })

  app.get('/api/registrations/:reference', platform, requireAuth, async (req, res) => {
    const row = await db.get(
      `SELECT r.*, e.slug AS event_slug, e.name AS event_name, e.event_type,
              p.status AS payment_status, p.amount_minor, p.currency, p.transaction_ref,
              p.rejection_reason, t.name AS team_name,
              ps.id AS pass_id, ps.registration_id AS pass_registration_id
         FROM registrations r
         JOIN participants pt ON pt.id = r.participant_id
         JOIN events e ON e.id = r.event_id
         LEFT JOIN payments p ON p.id = r.payment_id
         LEFT JOIN teams t ON t.id = r.team_id
         LEFT JOIN passes ps ON ps.registration_id = r.id
        WHERE r.reference = ?`,
      [req.params.reference],
    )

    if (!row) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration not found.' } })
    }

    const owner = await db.get(
      'SELECT user_id FROM participants WHERE id = ?',
      [row.participant_id],
    )
    if (!owner || owner.user_id !== Number(req.user.sub)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This registration belongs to another participant.' },
      })
    }

    const members = await db.all(
      `SELECT r.id, r.reference, r.status, r.is_captain, pt.full_name, pt.email, pt.campus
         FROM registrations r JOIN participants pt ON pt.id = r.participant_id
        WHERE ${row.team_id === null ? 'r.id = ?' : 'r.team_id = ?'}
        ORDER BY r.is_captain DESC, r.id`,
      [row.team_id === null ? row.id : row.team_id],
    )

    const settings = await db.get(SETTINGS_SELECT, [row.event_id])

    res.json({
      data: {
        id: row.id,
        reference: row.reference,
        status: row.status,
        eventSlug: row.event_slug,
        eventTitle: row.event_name,
        eventType: row.event_type,
        teamName: row.team_name,
        isCaptain: Boolean(row.is_captain),
        seats: row.seats,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
        holdExpiresAt: row.hold_expires_at,
        payment: row.payment_status
          ? {
              status: row.payment_status,
              amountMinor: row.amount_minor,
              amountLabel: `₹${(row.amount_minor / 100).toLocaleString('en-IN')}`,
              currency: row.currency,
              transactionRef: row.transaction_ref,
              rejectionReason: row.rejection_reason,
            }
          : null,
        paymentInstructions: settings?.payment_instructions ?? null,
        paymentQrUrl: settings?.payment_qr_url ?? null,
        members: members.map((member) => ({
          reference: member.reference,
          fullName: member.full_name,
          email: member.email,
          campus: member.campus,
          status: member.status,
          isCaptain: Boolean(member.is_captain),
        })),
        pass: row.pass_id
          ? { id: row.pass_id, token: passToken({ id: row.pass_id, registration_id: row.id }) }
          : null,
      },
    })
  })

  app.post('/api/registrations/:reference/payment', platform, requireAuth, writingLimit, async (req, res) => {
    const reference = clean(req.body?.transactionRef, 80)
    if (reference.length < 4) {
      throw fail(400, 'VALIDATION_ERROR', 'Enter the UPI transaction reference.', {
        transactionRef: 'At least 4 characters.',
      })
    }

    const registration = await db.get('SELECT * FROM registrations WHERE reference = ?', [
      req.params.reference,
    ])
    if (!registration) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration not found.' } })
    }

    const participant = await db.get('SELECT user_id FROM participants WHERE id = ?', [
      registration.participant_id,
    ])
    if (!participant || participant.user_id !== Number(req.user.sub)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This registration belongs to another participant.' },
      })
    }

    if (!['pending_payment', 'rejected'].includes(registration.status)) {
      throw fail(409, 'INVALID_STATE', 'A payment reference cannot be submitted in this state.')
    }

    if (!registration.payment_id) {
      throw fail(409, 'NO_PAYMENT', 'This registration does not require a payment.')
    }

    const settings = await db.get('SELECT pending_hold_minutes FROM event_registration_settings WHERE event_id = ?', [
      registration.event_id,
    ])

    await db.withTransaction(async (trx) => {
      await trx.run(
        `UPDATE payments
            SET transaction_ref = ?, status = 'submitted', submitted_by = ?, submitted_at = ?,
                rejection_reason = NULL, updated_at = ?
          WHERE id = ?`,
        [reference, Number(req.user.sub), now(), now(), registration.payment_id],
      )

      const holdUntil = new Date(
        Date.now() + (settings?.pending_hold_minutes ?? 1440) * 60_000,
      ).toISOString()

      const scope = registration.team_id
        ? 'team_id = ?'
        : 'id = ?'
      const scopeValue = registration.team_id ?? registration.id

      await trx.run(
        `UPDATE registrations
            SET status = 'verification_pending', hold_expires_at = ?, updated_at = ?
          WHERE payment_id = ? AND ${scope} AND status IN ('pending_payment', 'rejected')`,
        [holdUntil, now(), registration.payment_id, scopeValue],
      )
    })

    await audit(db, req, {
      action: 'payment.submit',
      entityType: 'payment',
      entityId: registration.payment_id,
      eventId: registration.event_id,
      metadata: { reference },
    })

    res.json({ data: { reference: registration.reference, status: 'verification_pending' } })
  })

  // ----------------------------------------------------- gateway checkout (UPI/cards)

  const gatewayLimit = rateLimit({ name: 'payment-gateway', windowMs: 60_000, max: 30 })

  async function openPayment(reference, userId) {
    const registration = await db.get('SELECT * FROM registrations WHERE reference = ?', [reference])
    if (!registration) {
      return { error: 404, code: 'NOT_FOUND', message: 'Registration not found.' }
    }

    const participant = await db.get('SELECT user_id FROM participants WHERE id = ?', [
      registration.participant_id,
    ])
    if (!participant || participant.user_id !== Number(userId)) {
      return { error: 403, code: 'FORBIDDEN', message: 'This registration belongs to another participant.' }
    }
    if (!registration.payment_id) {
      return { error: 409, code: 'NO_PAYMENT', message: 'This registration does not require a payment.' }
    }
    if (!['pending_payment', 'rejected'].includes(registration.status)) {
      return {
        error: 409,
        code: 'INVALID_STATE',
        message: 'This registration is not waiting for a payment.',
      }
    }

    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [registration.payment_id])
    if (!payment) {
      return { error: 409, code: 'NO_PAYMENT', message: 'No payment is attached to this registration.' }
    }

    return { registration, payment }
  }

  app.post('/api/registrations/:reference/payment/order', platform, requireAuth, gatewayLimit, async (req, res) => {
    const opened = await openPayment(req.params.reference, req.user.sub)
    if (opened.error) {
      return res
        .status(opened.error)
        .json({ error: { code: opened.code, message: opened.message } })
    }

    const config = razorpayConfig()
    if (!config.enabled) {
      return res.status(503).json({
        error: {
          code: 'PAYMENT_NOT_CONFIGURED',
          message:
            'The payment gateway is not configured on this deployment. An organizer can still verify a UPI payment manually.',
        },
      })
    }

    const { registration, payment } = opened

    // Razorpay keeps an order payable while its payments are only authorised,
    // so opening checkout again here could charge the captain a second time for
    // the same seat. The first payment must resolve before another is started.
    if (payment.provider_payment_id) {
      return res.status(409).json({
        error: {
          code: 'PAYMENT_IN_PROGRESS',
          message:
            'A payment for this registration is already authorised and awaiting capture. Do not pay again — it is confirmed automatically once the gateway captures it.',
        },
      })
    }

    let orderId = payment.provider_order_id

    // Reuse an open order so a page refresh does not create duplicate orders.
    if (!orderId) {
      const order = await createOrder({
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        receipt: registration.reference,
        notes: { reference: registration.reference, eventId: String(registration.event_id) },
      })
      orderId = order.id

      await db.run(
        `UPDATE payments
            SET provider = 'razorpay', provider_order_id = ?, provider_payload = ?, updated_at = ?
          WHERE id = ?`,
        [orderId, JSON.stringify(order), now(), payment.id],
      )

      await audit(db, req, {
        action: 'payment.order.create',
        entityType: 'payment',
        entityId: payment.id,
        eventId: registration.event_id,
        metadata: { orderId, amountMinor: payment.amount_minor },
      })
    }

    res.json({
      data: {
        keyId: config.keyId,
        orderId,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        reference: registration.reference,
        mode: config.mode,
        methods: config.methods,
        eventTitle: (await db.get('SELECT name FROM events WHERE id = ?', [registration.event_id]))?.name,
      },
    })
  })

  app.post(
    '/api/registrations/:reference/payment/verify',
    platform,
    requireAuth,
    gatewayLimit,
    async (req, res) => {
      const opened = await openPayment(req.params.reference, req.user.sub)
      if (opened.error) {
        // A repeated callback after a successful confirmation is not an error.
        if (opened.code === 'INVALID_STATE') {
          const current = await db.get('SELECT status FROM registrations WHERE reference = ?', [
            req.params.reference,
          ])
          if (current?.status === 'confirmed') {
            return res.json({ data: { status: 'confirmed', confirmed: true } })
          }
        }
        return res
          .status(opened.error)
          .json({ error: { code: opened.code, message: opened.message } })
      }

      const { orderId, paymentId, signature } = {
        orderId: String(req.body?.razorpay_order_id || ''),
        paymentId: String(req.body?.razorpay_payment_id || ''),
        signature: String(req.body?.razorpay_signature || ''),
      }

      if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
        return res.status(400).json({
          error: {
            code: 'SIGNATURE_INVALID',
            message: 'The payment signature could not be verified. No registration was confirmed.',
          },
        })
      }

      // The signature proves the callback came from Razorpay. The status and
      // amount are then read from Razorpay itself, never from the browser.
      const remote = await fetchPayment(paymentId)
      if (!remote || remote.order_id !== orderId) {
        return res.status(400).json({
          error: { code: 'PAYMENT_MISMATCH', message: 'That payment does not belong to this order.' },
        })
      }
      // Only a captured payment has actually moved money. An `authorized`
      // payment is still holdable and can be voided or expire, so confirming on
      // it would issue passes for money the merchant may never receive. The
      // webhook confirms later, when Razorpay reports the capture.
      if (remote.status !== 'captured') {
        await recordAuthorizedPayment(opened.payment.id, remote)
        return res.status(202).json({
          data: { status: remote.status, confirmed: false, captured: false },
        })
      }

      const result = await confirmGatewayPayment(opened.payment.id, {
        providerPaymentId: paymentId,
        providerSignature: signature,
        payload: remote,
        amountMinor: Number(remote.amount),
      })

      await audit(db, req, {
        action: 'payment.verify',
        entityType: 'payment',
        entityId: opened.payment.id,
        eventId: opened.registration.event_id,
        metadata: { paymentId, orderId, alreadyConfirmed: result.alreadyConfirmed },
      })

      res.json({
        data: {
          status: 'confirmed',
          confirmed: true,
          reference: opened.registration.reference,
        },
      })
    },
  )

  /**
   * Razorpay webhook. Public by nature, so the signature over the exact body is
   * the only thing that makes it trusted. Deliveries are idempotent by event id.
   */
  app.post('/api/payments/razorpay/webhook', async (req, res) => {
    const signature = req.get('x-razorpay-signature') || ''
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(400).json({ error: { code: 'SIGNATURE_INVALID', message: 'Invalid signature.' } })
    }

    const body = req.body || {}
    const entity = body?.payload?.payment?.entity || null
    const eventKey = String(body.event_id || `${body.event || 'event'}:${entity?.id || ''}`)
    if (!eventKey || eventKey.endsWith(':')) {
      return res.status(400).json({ error: { code: 'INVALID_EVENT', message: 'Missing event id.' } })
    }

    const payment = entity?.order_id
      ? await db.get('SELECT * FROM payments WHERE provider_order_id = ?', [entity.order_id])
      : null

    const inserted = await db.run(
      `INSERT INTO payment_events (provider, event_key, event_type, payment_id, payload)
       VALUES ('razorpay', ?, ?, ?, ?)
       ON CONFLICT (event_key) DO NOTHING`,
      [eventKey, body.event || null, payment?.id ?? null, JSON.stringify(body)],
    )

    // Already handled: acknowledge without repeating any side effect.
    if (!inserted.id) return res.json({ received: true, duplicate: true })

    // The event name alone is not proof of capture: the entity's own status is
    // what the confirmation trusts, so an `authorized` payload delivered under a
    // capture event cannot confirm a registration.
    if (payment && body.event === 'payment.captured' && entity?.status === 'captured') {
      try {
        await confirmGatewayPayment(payment.id, {
          providerPaymentId: entity.id,
          payload: entity,
          amountMinor: Number(entity.amount),
        })
      } catch (error) {
        console.error('[payments] webhook confirmation failed:', error.message)
        // A retry from the gateway is safer than acknowledging a failed write.
        return res.status(500).json({ error: { code: 'CONFIRM_FAILED', message: 'Retry later.' } })
      }
    }

    // An authorisation with no capture yet still blocks a second checkout, even
    // when the browser never reported back.
    if (payment && body.event === 'payment.authorized' && entity?.status === 'authorized') {
      await recordAuthorizedPayment(payment.id, entity)
    }

    if (payment && body.event === 'payment.failed') {
      await db.run(
        // The failed attempt releases the hold a new checkout would be blocked
        // by; an earlier captured payment can never be reached here because of
        // the status guard.
        `UPDATE payments
            SET status = 'rejected', rejection_reason = ?, provider_payload = ?,
                provider_payment_id = NULL, updated_at = ?
          WHERE id = ? AND status <> 'verified'`,
        [entity?.error_description || 'The gateway reported a failed payment.', JSON.stringify(entity), now(), payment.id],
      )
    }

    return res.json({ received: true })
  })

  // ------------------------------------------------------------------- passes

  app.get('/api/me/passes', platform, requireAuth, async (req, res) => {
    const rows = await db.all(
      `SELECT ps.*, r.reference, e.name AS event_name, e.slug AS event_slug, e.starts_at, e.venue
         FROM passes ps
         JOIN registrations r ON r.id = ps.registration_id
         JOIN participants pt ON pt.id = r.participant_id
         JOIN events e ON e.id = ps.event_id
        WHERE pt.user_id = ? AND ps.revoked_at IS NULL AND r.status = 'confirmed'
        ORDER BY e.starts_at NULLS LAST`,
      [Number(req.user.sub)],
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        token: passToken(row),
        reference: row.reference,
        eventTitle: row.event_name,
        eventSlug: row.event_slug,
        startsAt: row.starts_at,
        venue: row.venue,
        issuedAt: row.issued_at,
      })),
    })
  })

  // ------------------------------------------------------------- certificates

  app.get('/api/certificates/:code', platform, async (req, res) => {
    const certificate = await certificateByCode(db, req.params.code)
    if (!certificate) {
      return res.json({ data: { valid: false } })
    }

    res.json({
      data: {
        valid: !certificate.revoked_at,
        revoked: Boolean(certificate.revoked_at),
        certificate: {
          certificateNo: certificate.certificate_no,
          title: certificate.title,
          kind: certificate.kind,
          rankPosition: certificate.rank_position,
          participantName: certificate.full_name,
          eventTitle: certificate.event_name,
          issuedAt: certificate.issued_at,
        },
      },
    })
  })

  app.get('/api/certificates/:code/pdf', platform, async (req, res) => {
    const certificate = await certificateByCode(db, req.params.code)
    if (!certificate || certificate.revoked_at) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Certificate not found.' } })
    }

    const origin = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
    const pdf = renderCertificatePdf({
      title: certificate.title,
      name: certificate.full_name,
      eventTitle: certificate.event_name,
      eventDate: certificate.starts_at
        ? new Date(certificate.starts_at).toISOString().slice(0, 10)
        : undefined,
      certificateNo: certificate.certificate_no,
      verificationUrl: `${origin}/certificates/${certificate.verification_code}`,
      rankPosition: certificate.rank_position,
      issuedAt: certificate.issued_at,
    })

    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', `attachment; filename="${certificate.certificate_no}.pdf"`)
    res.send(pdf)
  })

  // ------------------------------------------------------- organizer: events

  app.get('/api/admin/events', platform, ...organizer, async (req, res) => {
    const rows = await db.all(`${EVENT_SELECT} ORDER BY e.created_at DESC`, eventParams())

    res.json({
      data: rows.map((row) => ({
        ...serializeEvent(row),
        seatsTaken: Number(row.seats_taken),
      })),
    })
  })

  // ------------------------------------------------- organizer: platform controls

  app.get('/api/admin/platform/settings', platform, ...organizer, async (req, res) => {
    const settings = await platformSettings()
    const gateway = razorpayConfig()

    res.json({
      data: {
        ...settings,
        organizerElevated: req.user.org === true,
        emailDeliveryConfigured: mailConfig().enabled,
        payments: {
          configured: gateway.enabled,
          mode: gateway.mode,
          // Only instruments the gateway actually presents are advertised.
          methods: gateway.enabled ? gateway.methods : [],
        },
      },
    })
  })

  app.put(
    '/api/admin/platform/settings',
    platform,
    ...organizer,
    requireElevated,
    async (req, res) => {
      if (req.body?.eventDiscoveryEnabled === undefined) {
        throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')
      }

      const enabled = Boolean(req.body.eventDiscoveryEnabled)
      await db.run(
        `INSERT INTO platform_settings (id, event_discovery_enabled, updated_by, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE
           SET event_discovery_enabled = EXCLUDED.event_discovery_enabled,
               updated_by = EXCLUDED.updated_by,
               updated_at = EXCLUDED.updated_at`,
        [enabled, Number(req.user.sub), now()],
      )

      await audit(db, req, {
        action: enabled ? 'platform.discovery.enable' : 'platform.discovery.disable',
        entityType: 'platform_settings',
        entityId: 1,
      })

      res.json({ data: { ...(await platformSettings()) } })
    },
  )

  app.post('/api/admin/events', platform, ...organizer, writingLimit, async (req, res) => {
    const input = validateEventInput(req.body || {}, { partial: false })
    const baseSlug = slugify(input.slug || input.title)

    let slug = baseSlug
    for (let suffix = 2; await db.get('SELECT id FROM events WHERE slug = ?', [slug]); suffix += 1) {
      slug = `${baseSlug}-${suffix}`
    }

    const created = await db.run(
      `INSERT INTO events
         (slug, name, tagline, short_description, description, event_type, lifecycle,
          is_published, registration_open, venue, starts_at, ends_at, organizer_name,
          organizer_email, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', FALSE, FALSE, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        input.title,
        input.tagline || null,
        input.shortDescription || null,
        input.description || null,
        input.type,
        input.venue || null,
        input.startsAt || null,
        input.endsAt || null,
        input.organizerName || null,
        input.organizerEmail || null,
        Number(req.user.sub),
        now(),
        now(),
      ],
    )

    await db.run('INSERT INTO event_registration_settings (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING', [
      created.id,
    ])

    // The guided create flow sends the rules it collected, plus an optional
    // registration configuration. Both are ordinary rows in the existing
    // content modules — no new frontend page is generated for a new event.
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : []
    for (const [index, rule] of rules.entries()) {
      const title = clean(typeof rule === 'string' ? rule : rule?.title, 160)
      if (!title) continue
      await db.run(
        'INSERT INTO event_rules (event_id, section, title, body, sort_order) VALUES (?, ?, ?, ?, ?)',
        [created.id, 'rules', title, text(typeof rule === 'string' ? '' : rule?.body) || null, index],
      )
    }

    const registration = req.body?.registration
    if (registration && typeof registration === 'object') {
      const capacity = Number(registration.capacity)
      const minTeamSize = Number(registration.minTeamSize)
      const maxTeamSize = Number(registration.maxTeamSize)
      const feeMinor = Number(registration.feeMinor)
      const mode = ['individual', 'team', 'both'].includes(registration.registrationMode)
        ? registration.registrationMode
        : 'individual'

      await db.run(
        `UPDATE event_registration_settings
            SET enabled = ?, is_paid = ?, fee_minor = ?, capacity = ?,
                registration_mode = ?, min_team_size = ?, max_team_size = ?, updated_at = ?
          WHERE event_id = ?`,
        [
          Boolean(registration.enabled),
          Boolean(registration.isPaid),
          Number.isInteger(feeMinor) && feeMinor >= 0 ? feeMinor : 0,
          Number.isInteger(capacity) && capacity > 0 ? capacity : null,
          mode,
          Number.isInteger(minTeamSize) && minTeamSize >= 1 ? minTeamSize : 1,
          Number.isInteger(maxTeamSize) && maxTeamSize >= 1 ? maxTeamSize : 1,
          now(),
          created.id,
        ],
      )
    }

    await audit(db, req, {
      action: 'event.create',
      entityType: 'event',
      entityId: created.id,
      eventId: created.id,
      metadata: { title: input.title, slug },
    })

    const row = await db.get(`${EVENT_SELECT} WHERE e.id = ?`, [...eventParams(), created.id])
    res.status(201).json({ data: serializeEvent(row) })
  })

  app.patch('/api/admin/events/:id', platform, ...organizer, writingLimit, async (req, res) => {
    const id = parseId(req.params.id)
    const existing = id && (await db.get('SELECT * FROM events WHERE id = ?', [id]))
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    const input = validateEventInput(req.body || {}, { partial: true })
    const columns = []
    const values = []

    const mapping = {
      title: 'name',
      tagline: 'tagline',
      shortDescription: 'short_description',
      description: 'description',
      type: 'event_type',
      venue: 'venue',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      organizerName: 'organizer_name',
      organizerEmail: 'organizer_email',
    }

    for (const [key, column] of Object.entries(mapping)) {
      if (input[key] === undefined) continue
      columns.push(`${column} = ?`)
      values.push(input[key] === '' ? null : input[key])
    }

    for (const [key, column] of [
      ['coverAssetId', 'cover_asset_id'],
      ['heroAssetId', 'hero_asset_id'],
    ]) {
      if (req.body?.[key] === undefined) continue
      const assetId = parseId(req.body[key])
      if (assetId) {
        const asset = await db.get('SELECT id, event_id FROM media_assets WHERE id = ?', [assetId])
        if (!asset || Number(asset.event_id) !== Number(id)) {
          throw fail(400, 'VALIDATION_ERROR', 'That image does not belong to this event.', {
            [key]: 'Upload the image to this event first.',
          })
        }
      }
      columns.push(`${column} = ?`)
      values.push(assetId)
    }

    if (!columns.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Nothing to update.' } })
    }

    columns.push('updated_at = ?')
    values.push(now(), id)
    await db.run(`UPDATE events SET ${columns.join(', ')} WHERE id = ?`, values)

    await audit(db, req, {
      action: 'event.update',
      entityType: 'event',
      entityId: id,
      eventId: id,
      metadata: { fields: Object.keys(input) },
    })

    const row = await db.get(`${EVENT_SELECT} WHERE e.id = ?`, [...eventParams(), id])
    res.json({ data: serializeEvent(row) })
  })

  app.post('/api/admin/events/:id/lifecycle', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const lifecycle = String(req.body?.lifecycle || '')
    if (!LIFECYCLES.includes(lifecycle)) {
      throw fail(400, 'VALIDATION_ERROR', `lifecycle must be one of: ${LIFECYCLES.join(', ')}.`)
    }

    const eventRow = id && (await db.get('SELECT * FROM events WHERE id = ?', [id]))
    if (!eventRow) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    const registrationOpen = ['registration_open', 'ongoing'].includes(lifecycle)
    await db.run(
      `UPDATE events
          SET lifecycle = ?, registration_open = ?, archived_at = ?, updated_at = ?
        WHERE id = ?`,
      [lifecycle, registrationOpen, lifecycle === 'archived' ? now() : null, now(), id],
    )

    await audit(db, req, {
      action: 'event.lifecycle',
      entityType: 'event',
      entityId: id,
      eventId: id,
      metadata: { from: eventRow.lifecycle, to: lifecycle },
    })

    res.json({ data: { id, lifecycle, registrationOpen } })
  })

  app.post('/api/admin/events/:id/publish', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const published = req.body?.published !== false
    const eventRow = id && (await db.get('SELECT * FROM events WHERE id = ?', [id]))
    if (!eventRow) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    await db.run('UPDATE events SET is_published = ?, updated_at = ? WHERE id = ?', [
      published,
      now(),
      id,
    ])

    await audit(db, req, {
      action: published ? 'event.publish' : 'event.unpublish',
      entityType: 'event',
      entityId: id,
      eventId: id,
    })

    res.json({ data: { id, isPublished: published } })
  })

  app.put('/api/admin/events/:id/settings', platform, ...organizer, writingLimit, async (req, res) => {
    const id = parseId(req.params.id)
    const eventRow = id && (await db.get('SELECT id FROM events WHERE id = ?', [id]))
    if (!eventRow) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } })
    }

    const body = req.body || {}
    const fields = {}
    const errors = {}

    const assignNumber = (key, column, { min = 0, max = 1_000_000 } = {}) => {
      if (body[key] === undefined) return
      const value = Number(body[key])
      if (!Number.isInteger(value) || value < min || value > max) {
        errors[key] = `${key} must be an integer between ${min} and ${max}.`
        return
      }
      fields[column] = value
    }

    if (body.enabled !== undefined) fields.enabled = Boolean(body.enabled)
    if (body.isPaid !== undefined) fields.is_paid = Boolean(body.isPaid)
    assignNumber('feeMinor', 'fee_minor')
    assignNumber('capacity', 'capacity', { min: 1 })
    assignNumber('minTeamSize', 'min_team_size', { min: 1, max: 50 })
    assignNumber('maxTeamSize', 'max_team_size', { min: 1, max: 50 })
    assignNumber('pendingHoldMinutes', 'pending_hold_minutes', { min: 5, max: 20160 })

    if (body.registrationMode !== undefined) {
      if (!['individual', 'team', 'both'].includes(body.registrationMode)) {
        errors.registrationMode = 'registrationMode must be individual, team or both.'
      } else fields.registration_mode = body.registrationMode
    }
    if (body.feeUnit !== undefined) {
      if (!['team', 'participant'].includes(body.feeUnit)) {
        errors.feeUnit = 'feeUnit must be team or participant.'
      } else fields.fee_unit = body.feeUnit
    }
    if (body.currency !== undefined) fields.currency = clean(body.currency, 3).toUpperCase() || 'INR'
    if (body.opensAt !== undefined) fields.opens_at = body.opensAt || null
    if (body.closesAt !== undefined) fields.closes_at = body.closesAt || null
    if (body.paymentInstructions !== undefined) fields.payment_instructions = text(body.paymentInstructions)
    if (body.paymentQrAssetId !== undefined) fields.payment_qr_asset_id = parseId(body.paymentQrAssetId)

    if (
      fields.min_team_size !== undefined &&
      fields.max_team_size !== undefined &&
      fields.max_team_size < fields.min_team_size
    ) {
      errors.maxTeamSize = 'maxTeamSize must be greater than or equal to minTeamSize.'
    }

    if (Object.keys(errors).length) {
      throw fail(400, 'VALIDATION_ERROR', 'Check the registration configuration.', errors)
    }

    const columns = Object.keys(fields)
    if (!columns.length) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Nothing to update.' } })
    }

    await db.run(
      `INSERT INTO event_registration_settings (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING`,
      [id],
    )
    await db.run(
      `UPDATE event_registration_settings
          SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = ?
        WHERE event_id = ?`,
      [...columns.map((column) => fields[column]), now(), id],
    )

    await audit(db, req, {
      action: 'event.settings',
      entityType: 'event',
      entityId: id,
      eventId: id,
      metadata: fields,
    })

    const settings = await db.get(SETTINGS_SELECT, [id])
    res.json({ data: serializeSettings(settings, { seats_taken: await seatUsage(db, id) }) })
  })

  // ------------------------------------------------------- organizer: content

  app.get('/api/admin/events/:id/content', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid event id.')

    const row = await db.get(`${EVENT_SELECT} WHERE e.id = ?`, [...eventParams(), id])
    if (!row) throw fail(404, 'NOT_FOUND', 'Event not found.')

    const [domains, topics, rules, criteria, faqs, speakers, sessions, registrationFields, media] =
      await Promise.all([
        db.all('SELECT * FROM event_domains WHERE event_id = ? ORDER BY sort_order, id', [id]),
        db.all('SELECT * FROM event_topics WHERE event_id = ? ORDER BY sort_order, id', [id]),
        db.all('SELECT * FROM event_rules WHERE event_id = ? ORDER BY section, sort_order, id', [id]),
        db.all('SELECT * FROM event_criteria WHERE event_id = ? ORDER BY sort_order, id', [id]),
        db.all('SELECT * FROM event_faqs WHERE event_id = ? ORDER BY sort_order, id', [id]),
        db.all(
          `SELECT s.*, es.sort_order FROM event_speakers es
             JOIN speakers s ON s.id = es.speaker_id
            WHERE es.event_id = ? ORDER BY es.sort_order, s.id`,
          [id],
        ),
        db.all(
          `SELECT s.* FROM event_sessions s
            WHERE s.event_id = ? ORDER BY s.sort_order, s.starts_at NULLS LAST, s.id`,
          [id],
        ),
        db.all('SELECT * FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order, id', [id]),
        db.all('SELECT * FROM media_assets WHERE event_id = ? ORDER BY sort_order, id', [id]),
      ])

    res.json({
      data: {
        event: serializeEvent(row),
        content: {
          domains: domains.map((item) => ({ id: item.id, title: item.title, description: item.description })),
          topics: topics.map((item) => ({ id: item.id, title: item.title, description: item.description })),
          rules: rules.map((item) => ({
            id: item.id,
            section: item.section,
            title: item.title,
            body: item.body,
          })),
          criteria: criteria.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            weight: item.weight,
          })),
          faqs: faqs.map((item) => ({
            id: item.id,
            question: item.question,
            answer: item.answer,
            isPublished: Boolean(item.is_published),
          })),
        },
        speakers: speakers.map((item) => ({
          id: item.id,
          name: item.name,
          title: item.title,
          organization: item.organization,
          bio: item.bio,
          profileUrl: item.profile_url,
        })),
        sessions: sessions.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          speakerId: item.speaker_id,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          venue: item.venue,
          sortOrder: item.sort_order,
        })),
        registrationFields: registrationFields.map((item) => ({
          id: item.id,
          key: item.field_key,
          label: item.label,
          type: item.field_type,
          options: item.options,
          required: Boolean(item.is_required),
          sortOrder: item.sort_order,
        })),
        media: media.map((item) => ({
          id: item.id,
          url: item.url,
          caption: item.caption,
          placement: item.placement,
          isPublished: Boolean(item.is_published),
        })),
      },
    })
  })

  for (const kind of Object.keys(CONTENT_KINDS)) {
    app.post(`/api/admin/events/:id/content/${kind}`, platform, ...organizer, async (req, res) => {
      const id = parseId(req.params.id)
      if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid event id.')

      const fields = pickContent(kind, req.body || {})
      const columns = Object.keys(fields)
      if (!columns.length) {
        throw fail(400, 'VALIDATION_ERROR', 'No content fields were supplied.')
      }

      const created = await db.run(
        `INSERT INTO ${CONTENT_KINDS[kind]} (event_id, ${columns.join(', ')}, sort_order)
         VALUES (?, ${columns.map(() => '?').join(', ')}, ?)`,
        [
          id,
          ...columns.map((column) => fields[column]),
          Number(req.body?.sortOrder ?? 0) || 0,
        ],
      )

      await audit(db, req, {
        action: `content.create.${kind}`,
        entityType: CONTENT_KINDS[kind],
        entityId: created.id,
        eventId: id,
      })

      res.status(201).json({ data: { id: created.id, ...fields } })
    })

    app.patch(`/api/admin/content/${kind}/:itemId`, platform, ...organizer, async (req, res) => {
      const itemId = parseId(req.params.itemId)
      if (!itemId) throw fail(400, 'VALIDATION_ERROR', 'Invalid content id.')

      const fields = pickContent(kind, req.body || {})
      const columns = Object.keys(fields)
      if (!columns.length) {
        throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')
      }

      await db.run(
        `UPDATE ${CONTENT_KINDS[kind]} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
        [...columns.map((column) => fields[column]), itemId],
      )

      res.json({ data: { id: itemId, ...fields } })
    })

    app.delete(`/api/admin/content/${kind}/:itemId`, platform, ...organizer, async (req, res) => {
      const itemId = parseId(req.params.itemId)
      if (!itemId) throw fail(400, 'VALIDATION_ERROR', 'Invalid content id.')
      await db.run(`DELETE FROM ${CONTENT_KINDS[kind]} WHERE id = ?`, [itemId])
      res.status(204).end()
    })
  }

  app.post('/api/admin/speakers', platform, ...organizer, async (req, res) => {
    const name = clean(req.body?.name, 120)
    if (name.length < 2) throw fail(400, 'VALIDATION_ERROR', 'A speaker name is required.')

    const created = await db.run(
      'INSERT INTO speakers (name, title, organization, bio, profile_url) VALUES (?, ?, ?, ?, ?)',
      [
        name,
        clean(req.body?.title, 160) || null,
        clean(req.body?.organization, 160) || null,
        text(req.body?.bio) || null,
        clean(req.body?.profileUrl, 2048) || null,
      ],
    )

    res.status(201).json({ data: { id: created.id, name } })
  })

  app.patch('/api/admin/speakers/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid speaker id.')

    const mapping = { name: 'name', title: 'title', organization: 'organization', bio: 'bio', profileUrl: 'profile_url' }
    const columns = []
    const values = []
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body?.[key] === undefined) continue
      columns.push(`${column} = ?`)
      values.push(key === 'bio' ? text(req.body[key]) || null : clean(req.body[key], 2048) || null)
    }
    if (!columns.length) throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')

    await db.run(`UPDATE speakers SET ${columns.join(', ')} WHERE id = ?`, [...values, id])
    res.json({ data: { id } })
  })

  app.post('/api/admin/events/:id/speakers', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    const speakerId = parseId(req.body?.speakerId)
    if (!eventId || !speakerId) throw fail(400, 'VALIDATION_ERROR', 'eventId and speakerId are required.')

    await db.run(
      `INSERT INTO event_speakers (event_id, speaker_id, sort_order) VALUES (?, ?, ?)
       ON CONFLICT (event_id, speaker_id) DO NOTHING`,
      [eventId, speakerId, Number(req.body?.sortOrder ?? 0) || 0],
    )
    res.status(201).json({ data: { eventId, speakerId } })
  })

  app.delete('/api/admin/events/:id/speakers/:speakerId', platform, ...organizer, async (req, res) => {
    await db.run('DELETE FROM event_speakers WHERE event_id = ? AND speaker_id = ?', [
      parseId(req.params.id),
      parseId(req.params.speakerId),
    ])
    res.status(204).end()
  })

  app.post('/api/admin/events/:id/sessions', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    const title = clean(req.body?.title, 160)
    if (!eventId || title.length < 2) throw fail(400, 'VALIDATION_ERROR', 'A session title is required.')

    const created = await db.run(
      `INSERT INTO event_sessions (event_id, title, description, speaker_id, starts_at, ends_at, venue, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        title,
        text(req.body?.description) || null,
        parseId(req.body?.speakerId),
        req.body?.startsAt || null,
        req.body?.endsAt || null,
        clean(req.body?.venue, 200) || null,
        Number(req.body?.sortOrder ?? 0) || 0,
      ],
    )

    res.status(201).json({ data: { id: created.id, title } })
  })

  app.patch('/api/admin/sessions/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid session id.')

    const mapping = {
      title: 'title',
      description: 'description',
      speakerId: 'speaker_id',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      venue: 'venue',
      sortOrder: 'sort_order',
    }
    const columns = []
    const values = []
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body?.[key] === undefined) continue
      columns.push(`${column} = ?`)
      const value = req.body[key]
      values.push(
        ['speakerId', 'sortOrder'].includes(key)
          ? Number(value) || null
          : ['description'].includes(key)
            ? text(value) || null
            : value || null,
      )
    }
    if (!columns.length) throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')

    await db.run(`UPDATE event_sessions SET ${columns.join(', ')} WHERE id = ?`, [...values, id])
    res.json({ data: { id } })
  })

  app.delete('/api/admin/sessions/:id', platform, ...organizer, async (req, res) => {
    await db.run('DELETE FROM event_sessions WHERE id = ?', [parseId(req.params.id)])
    res.status(204).end()
  })

  // ------------------------------------------ organizer: registration fields

  const FIELD_TYPES = ['text', 'textarea', 'select', 'number', 'email', 'phone']

  const normalizeOptions = (raw) => {
    const list = Array.isArray(raw) ? raw : String(raw || '').split(',')
    return list.map((option) => clean(option, 80)).filter(Boolean).slice(0, 20)
  }

  app.post('/api/admin/events/:id/fields', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    if (!eventId) throw fail(400, 'VALIDATION_ERROR', 'Invalid event id.')

    const label = clean(req.body?.label, 120)
    const key =
      clean(req.body?.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
    const type = FIELD_TYPES.includes(req.body?.type) ? req.body.type : 'text'
    const options = normalizeOptions(req.body?.options)

    if (label.length < 2 || !/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
      throw fail(400, 'VALIDATION_ERROR', 'Give the field a label and a lowercase key.', {
        label: label.length < 2 ? 'A label is required.' : undefined,
        key: /^[a-z][a-z0-9_]{0,39}$/.test(key) ? undefined : 'Use a lowercase key such as shirt_size.',
      })
    }
    if (type === 'select' && !options.length) {
      throw fail(400, 'VALIDATION_ERROR', 'A select field needs at least one option.', {
        options: 'List the options, separated by commas.',
      })
    }

    const created = await db.run(
      `INSERT INTO event_registration_fields
         (event_id, field_key, label, field_type, options, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        key,
        label,
        type,
        JSON.stringify(options),
        Boolean(req.body?.required),
        Number(req.body?.sortOrder ?? 0) || 0,
      ],
    )

    await audit(db, req, {
      action: 'registration_field.create',
      entityType: 'event_registration_field',
      entityId: created.id,
      eventId,
    })

    res.status(201).json({ data: { id: created.id, key, label, type, options } })
  })

  app.patch('/api/admin/fields/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid field id.')

    const mapping = { label: 'label', type: 'field_type', required: 'is_required', sortOrder: 'sort_order' }
    const columns = []
    const values = []
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body?.[key] === undefined) continue
      columns.push(`${column} = ?`)
      values.push(
        key === 'sortOrder'
          ? Number(req.body[key]) || 0
          : key === 'required'
            ? Boolean(req.body[key])
            : clean(req.body[key], 120),
      )
    }
    if (req.body?.options !== undefined) {
      columns.push('options = ?')
      values.push(JSON.stringify(normalizeOptions(req.body.options)))
    }
    if (!columns.length) throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')

    await db.run(`UPDATE event_registration_fields SET ${columns.join(', ')} WHERE id = ?`, [
      ...values,
      id,
    ])
    res.json({ data: { id } })
  })

  app.delete('/api/admin/fields/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid field id.')
    await db.run('DELETE FROM event_registration_fields WHERE id = ?', [id])
    res.status(204).end()
  })

  // ------------------------------------------------ organizer: registrations

  app.get('/api/admin/events/:id/registrations', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    if (!eventId) throw fail(400, 'VALIDATION_ERROR', 'Invalid event id.')

    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null
    const search = clean(req.query.q, 120)
    const filters = ['r.event_id = ?']
    const params = [eventId]

    if (status) {
      filters.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      filters.push(
        `(pt.full_name ${db.likeOperator} ? OR pt.email ${db.likeOperator} ? OR r.reference ${db.likeOperator} ?)`,
      )
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const rows = await db.all(
      `SELECT r.*, pt.full_name, pt.email, pt.campus, pt.user_id,
              t.name AS team_name,
              p.status AS payment_status, p.amount_minor, p.transaction_ref, p.verified_at,
              (SELECT COUNT(*) FROM check_ins c JOIN passes ps ON ps.id = c.pass_id
                WHERE ps.registration_id = r.id AND c.reverted_at IS NULL) AS checked_in
         FROM registrations r
         JOIN participants pt ON pt.id = r.participant_id
         LEFT JOIN teams t ON t.id = r.team_id
         LEFT JOIN payments p ON p.id = r.payment_id
        WHERE ${filters.join(' AND ')}
        ORDER BY r.created_at DESC
        LIMIT 500`,
      params,
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        fullName: row.full_name,
        email: row.email,
        campus: row.campus,
        status: row.status,
        isCaptain: Boolean(row.is_captain),
        teamName: row.team_name,
        hasAccount: Boolean(row.user_id),
        checkedIn: Number(row.checked_in) > 0,
        payment: row.payment_status
          ? {
              status: row.payment_status,
              amountMinor: row.amount_minor,
              transactionRef: row.transaction_ref,
              verifiedAt: row.verified_at,
            }
          : null,
        createdAt: row.created_at,
      })),
    })
  })

  app.get('/api/admin/events/:id/stats', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    if (!eventId) throw fail(400, 'VALIDATION_ERROR', 'Invalid event id.')

    const [byStatus, seats, payments, checkins] = await Promise.all([
      db.all(
        'SELECT status, COUNT(*) AS count FROM registrations WHERE event_id = ? GROUP BY status',
        [eventId],
      ),
      seatUsage(db, eventId),
      db.all(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_minor), 0) AS amount
           FROM payments WHERE event_id = ? GROUP BY status`,
        [eventId],
      ),
      db.get(
        `SELECT COUNT(*) AS count FROM check_ins WHERE event_id = ? AND reverted_at IS NULL`,
        [eventId],
      ),
    ])

    const settings = await db.get('SELECT capacity FROM event_registration_settings WHERE event_id = ?', [
      eventId,
    ])

    res.json({
      data: {
        seatsTaken: seats,
        capacity: settings?.capacity ?? null,
        byStatus: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.count)])),
        payments: Object.fromEntries(
          payments.map((row) => [row.status, { count: Number(row.count), amountMinor: Number(row.amount) }]),
        ),
        checkedIn: Number(checkins?.count ?? 0),
      },
    })
  })

  app.post('/api/admin/registrations/:id/status', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    const status = String(req.body?.status || '')
    if (!id || !['cancelled', 'rejected', 'refunded'].includes(status)) {
      throw fail(400, 'VALIDATION_ERROR', 'status must be cancelled, rejected or refunded.')
    }

    const registration = await db.get('SELECT * FROM registrations WHERE id = ?', [id])
    if (!registration) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration not found.' } })
    }

    await db.run(
      'UPDATE registrations SET status = ?, cancelled_at = ?, hold_expires_at = NULL, updated_at = ? WHERE id = ?',
      [status, status === 'cancelled' ? now() : null, now(), id],
    )

    await audit(db, req, {
      action: 'registration.status',
      entityType: 'registration',
      entityId: id,
      eventId: registration.event_id,
      metadata: { from: registration.status, to: status, reason: clean(req.body?.reason, 500) },
    })

    res.json({ data: { id, status } })
  })

  // ------------------------------------------------------ organizer: payments

  app.get('/api/admin/payments', platform, ...organizer, async (req, res) => {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null
    const eventId = parseId(req.query.event)
    const filters = ['1 = 1']
    const params = []
    if (status) {
      filters.push('p.status = ?')
      params.push(status)
    }
    if (eventId) {
      filters.push('p.event_id = ?')
      params.push(eventId)
    }

    const rows = await db.all(
      `SELECT p.*, e.name AS event_name, t.name AS team_name,
              (SELECT COUNT(*) FROM registrations r WHERE r.payment_id = p.id) AS member_count,
              (SELECT MIN(pt.full_name) FROM registrations r
                 JOIN participants pt ON pt.id = r.participant_id
                WHERE r.payment_id = p.id) AS captain_name
         FROM payments p
         JOIN events e ON e.id = p.event_id
         LEFT JOIN teams t ON t.id = p.team_id
        WHERE ${filters.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT 300`,
      params,
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        eventTitle: row.event_name,
        teamName: row.team_name,
        captainName: row.captain_name,
        memberCount: Number(row.member_count),
        amountMinor: row.amount_minor,
        currency: row.currency,
        status: row.status,
        transactionRef: row.transaction_ref,
        submittedAt: row.submitted_at,
        verifiedAt: row.verified_at,
        rejectionReason: row.rejection_reason,
      })),
    })
  })

  app.post('/api/admin/payments/:id/verify', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const payment = id && (await db.get('SELECT * FROM payments WHERE id = ?', [id]))
    if (!payment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment not found.' } })
    }
    if (payment.status !== 'submitted') {
      throw fail(409, 'INVALID_STATE', 'Only a submitted payment can be verified.')
    }

    const passes = await db.withTransaction(async (trx) => {
      await trx.run(
        `UPDATE payments
            SET status = 'verified', verified_by = ?, verified_at = ?, updated_at = ?
          WHERE id = ?`,
        [Number(req.user.sub), now(), now(), id],
      )

      const registrations = await trx.all(
        "SELECT * FROM registrations WHERE payment_id = ? AND status IN ('pending_payment', 'verification_pending', 'rejected')",
        [id],
      )

      const issued = []
      for (const registration of registrations) {
        await trx.run(
          `UPDATE registrations
              SET status = 'confirmed', confirmed_at = ?, hold_expires_at = NULL, updated_at = ?
            WHERE id = ?`,
          [now(), now(), registration.id],
        )
        const pass = await ensurePass(trx, registration)
        issued.push({ registrationId: registration.id, reference: registration.reference, passId: pass.id })
      }

      return issued
    })

    await audit(db, req, {
      action: 'payment.verify',
      entityType: 'payment',
      entityId: id,
      eventId: payment.event_id,
      metadata: { amountMinor: payment.amount_minor, confirmed: passes.length },
    })

    res.json({ data: { id, status: 'verified', confirmed: passes } })
  })

  app.post('/api/admin/payments/:id/reject', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const reason = clean(req.body?.reason, 500)
    const payment = id && (await db.get('SELECT * FROM payments WHERE id = ?', [id]))
    if (!payment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Payment not found.' } })
    }
    if (!reason) throw fail(400, 'VALIDATION_ERROR', 'A rejection reason is required.')

    await db.withTransaction(async (trx) => {
      await trx.run(
        `UPDATE payments
            SET status = 'rejected', rejection_reason = ?, verified_by = ?, verified_at = ?, updated_at = ?
          WHERE id = ?`,
        [reason, Number(req.user.sub), now(), now(), id],
      )
      await trx.run(
        `UPDATE registrations
            SET status = 'rejected', hold_expires_at = NULL, updated_at = ?
          WHERE payment_id = ? AND status IN ('pending_payment', 'verification_pending')`,
        [now(), id],
      )
    })

    await audit(db, req, {
      action: 'payment.reject',
      entityType: 'payment',
      entityId: id,
      eventId: payment.event_id,
      metadata: { reason },
    })

    res.json({ data: { id, status: 'rejected' } })
  })

  // ------------------------------------------------------- organizer: check-in

  app.post('/api/admin/checkins/scan', platform, ...organizer, requireElevated, async (req, res) => {
    const eventId = parseId(req.body?.eventId)
    const token = clean(req.body?.token, 400)
    if (!eventId || token.length < 16) {
      throw fail(400, 'VALIDATION_ERROR', 'A valid event and pass token are required.')
    }

    const outcome = await checkIn(db, req, { eventId, token, method: 'qr' })
    res.json({ data: outcome })
  })

  app.post('/api/admin/checkins/manual', platform, ...organizer, requireElevated, async (req, res) => {
    const eventId = parseId(req.body?.eventId)
    const reference = clean(req.body?.reference, 40)
    if (!eventId || !reference) {
      throw fail(400, 'VALIDATION_ERROR', 'A valid event and registration reference are required.')
    }

    const registration = await db.get('SELECT r.*, p.status AS payment_status FROM registrations r LEFT JOIN payments p ON p.id = r.payment_id WHERE r.event_id = ? AND r.reference = ?', [
      eventId,
      reference,
    ])
    if (!registration) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No registration with that reference.' } })
    }

    const pass = await ensurePass(db, registration)
    const outcome = await checkIn(db, req, { eventId, token: pass.token, method: 'manual' })
    res.json({ data: outcome })
  })

  app.post('/api/admin/checkins/:id/revert', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const reason = clean(req.body?.reason, 500)
    const checkIn = id && (await db.get('SELECT * FROM check_ins WHERE id = ?', [id]))
    if (!checkIn) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Check-in not found.' } })
    }
    if (checkIn.reverted_at) throw fail(409, 'INVALID_STATE', 'This check-in was already reverted.')
    if (!reason) throw fail(400, 'VALIDATION_ERROR', 'A revert reason is required.')

    await db.run(
      'UPDATE check_ins SET reverted_at = ?, reverted_by = ?, revert_reason = ? WHERE id = ?',
      [now(), Number(req.user.sub), reason, id],
    )

    await audit(db, req, {
      action: 'checkin.revert',
      entityType: 'check_in',
      entityId: id,
      eventId: checkIn.event_id,
      metadata: { reason },
    })

    res.json({ data: { id, reverted: true } })
  })

  app.get('/api/admin/events/:id/checkins', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.params.id)
    const rows = await db.all(
      `SELECT c.id, c.checked_in_at, c.method, c.reverted_at, c.revert_reason,
              r.reference, pt.full_name, pt.email, u.email AS organizer_email
         FROM check_ins c
         JOIN passes ps ON ps.id = c.pass_id
         JOIN registrations r ON r.id = ps.registration_id
         JOIN participants pt ON pt.id = r.participant_id
         LEFT JOIN users u ON u.id = c.checked_in_by
        WHERE c.event_id = ?
        ORDER BY c.checked_in_at DESC LIMIT 300`,
      [eventId],
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        fullName: row.full_name,
        email: row.email,
        method: row.method,
        checkedInAt: row.checked_in_at,
        checkedInBy: row.organizer_email,
        revertedAt: row.reverted_at,
        revertReason: row.revert_reason,
      })),
    })
  })

  // --------------------------------------------------- organizer: certificates

  app.post('/api/admin/certificates/issue', platform, ...organizer, requireElevated, async (req, res) => {
    const eventId = parseId(req.body?.eventId)
    const kind = ['participation', 'rank', 'special'].includes(req.body?.kind)
      ? req.body.kind
      : 'participation'
    const title = clean(req.body?.title, 120) || 'Certificate of Participation'
    const onlyAttended = req.body?.onlyAttended !== false
    const ids = Array.isArray(req.body?.registrationIds)
      ? req.body.registrationIds.map(parseId).filter(Boolean)
      : []

    if (!eventId) throw fail(400, 'VALIDATION_ERROR', 'eventId is required.')

    const filters = ['r.event_id = ?', "r.status = 'confirmed'"]
    const params = [eventId]
    if (ids.length) {
      filters.push(`r.id IN (${ids.map(() => '?').join(', ')})`)
      params.push(...ids)
    }
    if (onlyAttended) {
      filters.push(
        `EXISTS (SELECT 1 FROM check_ins c JOIN passes ps ON ps.id = c.pass_id
                  WHERE ps.registration_id = r.id AND c.reverted_at IS NULL)`,
      )
    }

    const eligible = await db.all(
      `SELECT r.id, pt.full_name FROM registrations r
         JOIN participants pt ON pt.id = r.participant_id
        WHERE ${filters.join(' AND ')}
        ORDER BY r.id`,
      params,
    )

    if (!eligible.length) {
      throw fail(409, 'NO_ELIGIBLE_PARTICIPANTS', 'No confirmed registration matches the eligibility rules.')
    }

    const issued = []
    for (const [index, registration] of eligible.entries()) {
      const existing = await db.get(
        'SELECT id, verification_code FROM certificates WHERE event_id = ? AND registration_id = ? AND kind = ? AND title = ?',
        [eventId, registration.id, kind, title],
      )
      if (existing) {
        issued.push({ registrationId: registration.id, id: existing.id, code: existing.verification_code, existing: true })
        continue
      }

      const certificateNo = `UF-${eventId}-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`
      const verificationCode = crypto.randomBytes(12).toString('base64url')

      const created = await db.run(
        `INSERT INTO certificates
           (event_id, registration_id, certificate_no, verification_code, kind, title, rank_position, issued_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          registration.id,
          certificateNo,
          verificationCode,
          kind,
          title,
          kind === 'rank' ? Number(req.body?.rankPositions?.[registration.id]) || null : null,
          Number(req.user.sub),
        ],
      )

      issued.push({ registrationId: registration.id, id: created.id, code: verificationCode, existing: false })
    }

    await audit(db, req, {
      action: 'certificate.issue',
      entityType: 'event',
      entityId: eventId,
      eventId,
      metadata: { kind, title, count: issued.length, onlyAttended },
    })

    res.status(201).json({ data: issued })
  })

  app.post('/api/admin/certificates/:id/revoke', platform, ...organizer, requireElevated, async (req, res) => {
    const id = parseId(req.params.id)
    const reason = clean(req.body?.reason, 500)
    const certificate = id && (await db.get('SELECT * FROM certificates WHERE id = ?', [id]))
    if (!certificate) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Certificate not found.' } })
    }
    if (!reason) throw fail(400, 'VALIDATION_ERROR', 'A revoke reason is required.')

    await db.run(
      'UPDATE certificates SET revoked_at = ?, revoked_by = ?, revoke_reason = ? WHERE id = ?',
      [now(), Number(req.user.sub), reason, id],
    )

    await audit(db, req, {
      action: 'certificate.revoke',
      entityType: 'certificate',
      entityId: id,
      eventId: certificate.event_id,
      metadata: { reason },
    })

    res.json({ data: { id, revoked: true } })
  })

  // ---------------------------------------------------- organizer: audit trail

  app.get('/api/admin/audit', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.query.event)
    const rows = await db.all(
      `SELECT a.*, u.email AS actor_email
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
        ${eventId === null ? '' : 'WHERE a.event_id = ?'}
        ORDER BY a.created_at DESC LIMIT 200`,
      eventId === null ? [] : [eventId],
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actor: row.actor_email,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
    })
  })

  // ------------------------------------------------- organizer: second factor

  app.get('/api/auth/organizer/status', platform, ...organizer, async (req, res) => {
    const code = await db.get('SELECT user_id FROM organizer_access_codes WHERE user_id = ?', [
      Number(req.user.sub),
    ])
    res.json({ data: { hasCode: Boolean(code), elevated: req.user.org === true } })
  })

  app.post('/api/auth/organizer/code', platform, ...organizer, writingLimit, async (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (code.length < 8 || code.length > 128) {
      throw fail(400, 'VALIDATION_ERROR', 'The organizer access code must be 8–128 characters.', {
        code: 'Use at least 8 characters.',
      })
    }

    await db.run(
      `INSERT INTO organizer_access_codes (user_id, code_hash, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, updated_at = EXCLUDED.updated_at`,
      [Number(req.user.sub), hashPassword(code), now()],
    )

    await audit(db, req, {
      action: 'organizer.code.set',
      entityType: 'user',
      entityId: Number(req.user.sub),
    })

    res.status(201).json({ data: { hasCode: true } })
  })

  app.post('/api/auth/organizer/verify', platform, ...organizer, rateLimit({ name: 'organizer-verify', windowMs: 60_000, max: 10 }), async (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code : ''
    const stored = await db.get('SELECT code_hash FROM organizer_access_codes WHERE user_id = ?', [
      Number(req.user.sub),
    ])

    if (!stored || !verifyPassword(code, stored.code_hash)) {
      return res.status(403).json({
        error: { code: 'INVALID_CODE', message: 'That organizer access code is not correct.' },
      })
    }

    const user = await db.get('SELECT id, email, role FROM users WHERE id = ?', [Number(req.user.sub)])
    const { token, expiresAt } = signToken(user, { organizer: true })

    await audit(db, req, {
      action: 'organizer.elevate',
      entityType: 'user',
      entityId: user.id,
    })

    res.json({ data: { token, expiresAt, user: { id: user.id, email: user.email, role: user.role } } })
  })

  // ---------------------------------------------------------- organizer: media

  app.get('/api/admin/media', platform, ...organizer, async (req, res) => {
    const eventId = parseId(req.query.event)
    const rows = await db.all(
      `SELECT m.*, e.name AS event_name FROM media_assets m
         LEFT JOIN events e ON e.id = m.event_id
        ${eventId === null ? '' : 'WHERE m.event_id = ?'}
        ORDER BY m.sort_order, m.id`,
      eventId === null ? [] : [eventId],
    )

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        eventTitle: row.event_name,
        url: row.url,
        caption: row.caption,
        credit: row.credit,
        alt: row.alt_text,
        placement: row.placement,
        isPublished: Boolean(row.is_published),
        isFeatured: Boolean(row.is_featured),
        sortOrder: row.sort_order,
        byteSize: row.byte_size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      })),
    })
  })

  app.patch('/api/admin/media/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    if (!id) throw fail(400, 'VALIDATION_ERROR', 'Invalid media id.')

    const mapping = {
      caption: 'caption',
      credit: 'credit',
      alt: 'alt_text',
      placement: 'placement',
      isPublished: 'is_published',
      isFeatured: 'is_featured',
      sortOrder: 'sort_order',
    }
    const columns = []
    const values = []
    for (const [key, column] of Object.entries(mapping)) {
      if (req.body?.[key] === undefined) continue
      columns.push(`${column} = ?`)
      const value = req.body[key]
      values.push(
        key === 'caption' || key === 'credit' || key === 'alt'
          ? clean(value, 500) || null
          : key === 'sortOrder'
            ? Number(value) || 0
            : key === 'placement'
              ? ['glimpse', 'hero', 'intro', 'speaker', 'description', 'transition', 'payment_qr'].includes(value)
                ? value
                : 'glimpse'
              : Boolean(value),
      )
    }
    if (!columns.length) throw fail(400, 'VALIDATION_ERROR', 'Nothing to update.')

    await db.run(`UPDATE media_assets SET ${columns.join(', ')} WHERE id = ?`, [...values, id])
    res.json({ data: { id } })
  })

  app.delete('/api/admin/media/:id', platform, ...organizer, async (req, res) => {
    const id = parseId(req.params.id)
    const asset = id && (await db.get('SELECT * FROM media_assets WHERE id = ?', [id]))
    if (!asset) throw fail(404, 'NOT_FOUND', 'Media not found.')

    await db.run('UPDATE events SET cover_asset_id = NULL WHERE cover_asset_id = ?', [id])
    await db.run('UPDATE events SET hero_asset_id = NULL WHERE hero_asset_id = ?', [id])
    await db.run('DELETE FROM media_assets WHERE id = ?', [id])

    if (keepsMediaBlobs(db)) {
      await db.run('DELETE FROM media_blobs WHERE storage_key = ?', [asset.storage_key])
    }

    try {
      fs.rmSync(path.join(mediaDir(), asset.storage_key), { force: true })
    } catch {
      // The row is gone; a missing file is not worth failing the request.
    }

    await audit(db, req, {
      action: 'media.delete',
      entityType: 'media_asset',
      entityId: id,
      eventId: asset.event_id,
    })

    res.status(204).end()
  })
}

/**
 * Upload route and public media root. Registered before the JSON body parser so
 * images stream through express.raw instead of being base64-inflated.
 */
export function registerMediaRoot(app, { db }) {
  const platform = requirePlatform(db)
  fs.mkdirSync(mediaDir(), { recursive: true })
  app.use('/media', express.static(mediaDir(), { maxAge: '7d', fallthrough: true }))

  // A host without a persistent disk replaces MEDIA_DIR on every deploy and
  // every idle spin-down, so the bytes are also kept in PostgreSQL and served
  // from there once the file is gone. The disk stays the first source, which
  // keeps local behaviour unchanged.
  app.get('/media/*', async (req, res, next) => {
    if (!keepsMediaBlobs(db)) return next()

    const storageKey = decodeURIComponent(req.params[0] || '')
    if (!storageKey) return next()

    const blob = await db.get('SELECT mime_type, data FROM media_blobs WHERE storage_key = ?', [storageKey])
    if (!blob) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found.' } })
    }

    res.set('Content-Type', blob.mime_type)
    res.set('Cache-Control', 'public, max-age=604800')
    return res.send(blob.data)
  })

  const requireGrant = async (req, res, next) => {
    const grant = await db.get(
      'SELECT user_id FROM organizer_grants WHERE user_id = ? AND revoked_at IS NULL',
      [Number(req.user.sub)],
    )
    if (!grant && req.user.role !== 'admin') {
      throw fail(403, 'FORBIDDEN', 'This account is not an authorized organizer.')
    }
    next()
  }

  app.post(
    '/api/admin/media',
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    platform,
    requireOrganizer,
    requireGrant,
    async (req, res) => {
      const mimeType = String(req.get('content-type') || '').split(';')[0].trim()
      const extension = IMAGE_EXTENSIONS[mimeType]
      if (!extension) {
        return res.status(415).json({
          error: {
            code: 'UNSUPPORTED_MEDIA',
            message: 'Upload a JPEG, PNG, WebP or AVIF image.',
          },
        })
      }

      const buffer = Buffer.isBuffer(req.body) ? req.body : null
      if (!buffer || buffer.length === 0) {
        throw fail(400, 'VALIDATION_ERROR', 'The uploaded file was empty.')
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Images must be 8 MB or smaller.' } })
      }

      const eventId = parseId(req.query.event)
      const eventRow = eventId ? await db.get('SELECT id, slug FROM events WHERE id = ?', [eventId]) : null
      if (!eventId || !eventRow) {
        throw fail(400, 'VALIDATION_ERROR', 'A valid event is required for an upload.')
      }

      const placement = ['glimpse', 'hero', 'intro', 'speaker', 'description', 'transition', 'payment_qr'].includes(
        req.query.placement,
      )
        ? req.query.placement
        : 'glimpse'

      const storageKey = `${eventRow.slug}/${crypto.randomUUID()}.${extension}`
      const absolute = path.join(mediaDir(), storageKey)
      fs.mkdirSync(path.dirname(absolute), { recursive: true })
      fs.writeFileSync(absolute, buffer)

      if (keepsMediaBlobs(db)) {
        await db.run(
          `INSERT INTO media_blobs (storage_key, mime_type, byte_size, data)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (storage_key) DO UPDATE
             SET data = excluded.data,
                 mime_type = excluded.mime_type,
                 byte_size = excluded.byte_size`,
          [storageKey, mimeType, buffer.length, buffer],
        )
      }

      const created = await db.run(
        `INSERT INTO media_assets
           (event_id, storage_key, url, mime_type, byte_size, alt_text, caption, credit,
            placement, is_published, is_featured, sort_order, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 0, ?)`,
        [
          eventId,
          storageKey,
          `/media/${storageKey}`,
          mimeType,
          buffer.length,
          clean(req.query.alt, 300) || null,
          clean(req.query.caption, 500) || null,
          clean(req.query.credit, 200) || null,
          placement,
          req.query.published === 'true',
          Number(req.user.sub),
        ],
      )

      await audit(db, req, {
        action: 'media.upload',
        entityType: 'media_asset',
        entityId: created.id,
        eventId,
        metadata: { bytes: buffer.length, mimeType, placement },
      })

      res.status(201).json({
        data: {
          id: created.id,
          url: `/media/${storageKey}`,
          mimeType,
          byteSize: buffer.length,
          placement,
        },
      })
    },
  )
}

// ------------------------------------------------------------------- helpers

function ensureRegistrationWindow(eventRow, settings) {
  if (!settings || !settings.enabled) {
    throw fail(409, 'REGISTRATION_CLOSED', 'Registration is not open for this event.')
  }
  if (['draft', 'completed', 'archived'].includes(eventRow.lifecycle)) {
    throw fail(409, 'REGISTRATION_CLOSED', 'Registration is not open for this event.')
  }

  const at = Date.now()
  if (settings.opens_at && new Date(settings.opens_at).getTime() > at) {
    throw fail(409, 'REGISTRATION_NOT_OPEN', 'Registration has not opened yet.')
  }
  if (settings.closes_at && new Date(settings.closes_at).getTime() < at) {
    throw fail(409, 'REGISTRATION_CLOSED', 'Registration has closed for this event.')
  }
}

async function validateCustomFields(db, eventId, raw) {
  const definitions = await db.all(
    `SELECT field_key, label, field_type, options, is_required
       FROM event_registration_fields WHERE event_id = ? ORDER BY sort_order, id`,
    [eventId],
  )
  if (!definitions.length) return {}

  const supplied = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const errors = {}
  const values = {}

  for (const definition of definitions) {
    const value = supplied[definition.field_key]
    const text_ = value === undefined || value === null ? '' : String(value).trim()
    const errorKey = `customFields.${definition.field_key}`

    if (!text_) {
      if (definition.is_required) errors[errorKey] = `${definition.label} is required.`
      continue
    }
    if (text_.length > 2000) {
      errors[errorKey] = `${definition.label} is too long.`
      continue
    }
    if (definition.field_type === 'number' && !Number.isFinite(Number(text_))) {
      errors[errorKey] = `${definition.label} must be a number.`
      continue
    }
    if (definition.field_type === 'select') {
      const options = Array.isArray(definition.options) ? definition.options.map(String) : []
      if (!options.includes(text_)) {
        errors[errorKey] = `Choose one of the listed options for ${definition.label}.`
        continue
      }
    }

    values[definition.field_key] = text_
  }

  if (Object.keys(errors).length) {
    throw fail(400, 'VALIDATION_ERROR', 'Check the additional registration questions.', errors)
  }

  return values
}

function validateMembers(body, settings, accountEmail) {
  const raw = Array.isArray(body.members) ? body.members : []
  const errors = {}

  if (!raw.length) {
    throw fail(400, 'VALIDATION_ERROR', 'Add at least one participant.', {
      members: 'Add at least one participant.',
    })
  }

  const max = settings.registration_mode === 'individual' ? 1 : settings.max_team_size
  const min = settings.registration_mode === 'individual' ? 1 : settings.min_team_size

  if (raw.length > max || raw.length < min) {
    throw fail(
      400,
      'VALIDATION_ERROR',
      min === max
        ? `This event registers exactly ${min} participant(s).`
        : `This event registers between ${min} and ${max} participants.`,
      { members: `Between ${min} and ${max} participants.` },
    )
  }

  const members = raw.map((member, index) => {
    const fullName = clean(member?.fullName, 120)
    const email = clean(member?.email, 200).toLowerCase()
    const campus = clean(member?.campus, 120)
    const phone = clean(member?.phone, 30)

    if (fullName.length < 2) errors[`members.${index}.fullName`] = 'Enter the full name.'
    if (!isEmail(email)) errors[`members.${index}.email`] = 'Enter a valid email address.'

    return { fullName, email, campus, phone }
  })

  // The captain is the signed-in account; the first member must be that person.
  members[0].email = String(accountEmail || '').toLowerCase()
  members[0].fullName = members[0].fullName || clean(body.captainName, 120)

  if (!isEmail(members[0].email)) {
    errors['members.0.email'] = 'Your account has no usable email address.'
  }
  if (members[0].fullName.length < 2) {
    errors['members.0.fullName'] = 'Enter your full name.'
  }

  if (new Set(members.map((member) => member.email)).size !== members.length) {
    throw fail(400, 'VALIDATION_ERROR', 'Each participant needs a different email address.', {
      members: 'Participant emails must be unique.',
    })
  }

  if (Object.keys(errors).length) {
    throw fail(400, 'VALIDATION_ERROR', 'Check the participant details.', errors)
  }

  return members
}

async function upsertParticipant(trx, member, { userId = null, verified = false }) {
  const existing = await trx.get('SELECT * FROM participants WHERE lower(email) = lower(?)', [member.email])

  if (existing) {
    await trx.run(
      `UPDATE participants
          SET full_name = ?, campus = COALESCE(NULLIF(?, ''), campus),
              phone = COALESCE(NULLIF(?, ''), phone),
              user_id = COALESCE(user_id, ?), claimed_at = CASE WHEN ? THEN COALESCE(claimed_at, ?) ELSE claimed_at END,
              updated_at = ?
        WHERE id = ?`,
      [
        member.fullName,
        member.campus,
        member.phone,
        verified ? userId : null,
        verified,
        now(),
        now(),
        existing.id,
      ],
    )
    return existing
  }

  const created = await trx.run(
    `INSERT INTO participants (email, full_name, phone, campus, user_id, claimed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      member.email,
      member.fullName,
      member.phone || null,
      member.campus || null,
      verified ? userId : null,
      verified ? now() : null,
    ],
  )

  return trx.get('SELECT * FROM participants WHERE id = ?', [created.id])
}

export async function claimParticipations(db, user) {
  const unclaimed = await db.all(
    'SELECT id FROM participants WHERE lower(email) = lower(?) AND user_id IS NULL',
    [user.email],
  )
  if (!unclaimed.length) return 0

  const timestamp = new Date().toISOString()
  for (const participant of unclaimed) {
    await db.run('UPDATE participants SET user_id = ?, claimed_at = ?, updated_at = ? WHERE id = ?', [
      user.id,
      timestamp,
      timestamp,
      participant.id,
    ])
  }

  return unclaimed.length
}

async function checkIn(db, req, { eventId, token, method }) {
  const pass = await db.get('SELECT * FROM passes WHERE token_hash = ?', [hashToken(token)])
  if (!pass) {
    throw fail(422, 'PASS_INVALID', 'This pass is not a valid UNSTABLE FORGE pass.')
  }
  if (pass.event_id !== eventId) {
    throw fail(422, 'WRONG_EVENT', 'This pass belongs to a different event.')
  }
  if (pass.revoked_at) {
    throw fail(422, 'PASS_REVOKED', 'This pass has been revoked.')
  }

  const registration = await db.get(
    `SELECT r.*, pt.full_name, pt.email, e.name AS event_name
       FROM registrations r
       JOIN participants pt ON pt.id = r.participant_id
       JOIN events e ON e.id = r.event_id
      WHERE r.id = ?`,
    [pass.registration_id],
  )

  if (!registration || registration.status !== 'confirmed') {
    throw fail(422, 'NOT_CONFIRMED', 'This registration is not confirmed, so the pass cannot be used.')
  }

  const existing = await db.get(
    'SELECT * FROM check_ins WHERE pass_id = ? AND reverted_at IS NULL',
    [pass.id],
  )
  if (existing) {
    return {
      status: 'already_checked_in',
      participant: registration.full_name,
      reference: registration.reference,
      checkedInAt: existing.checked_in_at,
    }
  }

  const created = await db.run(
    `INSERT INTO check_ins (pass_id, event_id, method, checked_in_by)
     VALUES (?, ?, ?, ?)`,
    [pass.id, eventId, method, Number(req.user.sub)],
  )

  await audit(db, req, {
    action: 'checkin.create',
    entityType: 'pass',
    entityId: pass.id,
    eventId,
    metadata: { method, reference: registration.reference },
  })

  return {
    status: 'checked_in',
    checkInId: created.id,
    participant: registration.full_name,
    reference: registration.reference,
    eventTitle: registration.event_name,
  }
}

function validateEventInput(body, { partial }) {
  const errors = {}
  const input = {}

  const set = (key, value) => {
    if (value !== undefined) input[key] = value
  }

  if (!partial || body.title !== undefined) {
    input.title = clean(body.title, 160)
    if (input.title.length < 3) errors.title = 'The event title must be at least 3 characters.'
  }

  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    input.slug = slugify(String(body.slug))
    if (!input.slug) errors.slug = 'Use letters, numbers and dashes.'
  }

  if (body.type !== undefined) {
    if (!EVENT_TYPES.includes(body.type)) {
      errors.type = `type must be one of: ${EVENT_TYPES.join(', ')}.`
    } else input.type = body.type
  } else if (!partial) {
    input.type = 'other'
  }

  if (body.startsAt !== undefined && body.startsAt) {
    const value = new Date(body.startsAt)
    if (Number.isNaN(value.getTime())) errors.startsAt = 'Use a valid date and time.'
    else input.startsAt = value.toISOString()
  } else set('startsAt', body.startsAt === null ? null : undefined)

  if (body.endsAt !== undefined && body.endsAt) {
    const value = new Date(body.endsAt)
    if (Number.isNaN(value.getTime())) errors.endsAt = 'Use a valid date and time.'
    else input.endsAt = value.toISOString()
  } else set('endsAt', body.endsAt === null ? null : undefined)

  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) {
    errors.endsAt = 'The event must end after it starts.'
  }

  set('tagline', body.tagline === undefined ? undefined : clean(body.tagline, 160))
  set('shortDescription', body.shortDescription === undefined ? undefined : clean(body.shortDescription, 400))
  set('description', body.description === undefined ? undefined : text(body.description))
  set('venue', body.venue === undefined ? undefined : clean(body.venue, 200))
  set('organizerName', body.organizerName === undefined ? undefined : clean(body.organizerName, 160))
  set('organizerEmail', body.organizerEmail === undefined ? undefined : clean(body.organizerEmail, 200))

  if (Object.keys(errors).length) {
    throw fail(400, 'VALIDATION_ERROR', 'Check the event details.', errors)
  }

  return input
}

function pickContent(kind, body) {
  const allowed = {
    domains: { title: clean(body.title, 160), description: text(body.description) || null },
    topics: { title: clean(body.title, 160), description: text(body.description) || null },
    rules: {
      section: clean(body.section, 40) || 'rules',
      title: clean(body.title, 160),
      body: text(body.body) || null,
    },
    criteria: {
      title: clean(body.title, 160),
      description: text(body.description) || null,
      weight: Number(body.weight) || null,
    },
    faqs: { question: clean(body.question, 300), answer: text(body.answer) },
  }[kind]

  if (!allowed) return {}

  const requiredKey = kind === 'faqs' ? 'question' : 'title'
  if (!allowed[requiredKey]) return {}

  return allowed
}

async function certificateByCode(db, code) {
  if (typeof code !== 'string' || code.length < 6) return null
  return db.get(
    `SELECT c.*, pt.full_name, e.name AS event_name, e.starts_at
       FROM certificates c
       JOIN registrations r ON r.id = c.registration_id
       JOIN participants pt ON pt.id = r.participant_id
       JOIN events e ON e.id = c.event_id
      WHERE c.verification_code = ? OR c.certificate_no = ?`,
    [code, code],
  )
}
