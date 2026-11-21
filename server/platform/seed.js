/**
 * Platform seed data.
 *
 * Idempotent: every block checks for existing rows first, so an organizer's
 * later edits are never overwritten on restart. Only genuinely known facts from
 * the product brief are inserted — no invented dates, venues, biographies or
 * payment details. Fields that are not confirmed stay NULL and the UI renders
 * them as TBA.
 */

const C3 = {
  slug: 'c3-crescent-code-clash',
  name: 'C³ — Crescent Code Clash',
  tagline: 'CODE. COMPETE. CONQUER.',
  shortDescription:
    'A build-first hackathon. One brief, one build window, working software over slides.',
  description: `C³ is designed around the distance between an idea and a working thing. The brief, the format and the judging all point at the same question: did you make something real?

That does not mean polished. It means honest — a small, working, demonstrable version of an idea rather than a large presentation about one.

Teams of one to four register together. Challenge domains are listed below and are configured by the organizers.`,
  eventType: 'hackathon',
  lifecycle: 'registration_open',
  isPublished: true,
  registrationOpen: true,
}

const C3_DOMAINS = [
  'Agentic AI',
  'FinTech',
  'Cybersecurity',
  'Smart Automation',
  'Road Safety',
  "Women's Safety",
  'Agriculture',
  'GenAI',
  'GovTech',
  'EduTech',
  'HealthCare',
]

const C3_SETTINGS = {
  enabled: true,
  isPaid: true,
  feeMinor: 30000, // ₹300, in paise
  currency: 'INR',
  capacity: 120, // individual participants, not teams
  inventoryUnit: 'participant',
  registrationMode: 'team',
  minTeamSize: 1,
  maxTeamSize: 4,
  pendingHoldMinutes: 1440,
  paymentInstructions:
    'Pay the registration fee by UPI using the payment QR shown on the registration page. Keep the UPI reference number — you will submit it so an organizer can verify the payment.',
}

const RHETORIC = {
  slug: 'rhetoric-rumble',
  name: 'Rhetoric Rumble',
  tagline: null,
  shortDescription: 'A debate competition. Draw your stance on the spot and argue it.',
  description: `Rhetoric Rumble is a debate competition. Stances are drawn on the spot, so every speaker argues both sides of a motion rather than reciting a prepared script.

Topics, speaking times and the participation format are configured by the organizers and shown on this page.`,
  eventType: 'debate',
  lifecycle: 'upcoming',
  isPublished: true,
  registrationOpen: false,
}

const RHETORIC_RULES = [
  { title: 'Two minutes to pitch', body: 'Each speaker gets two minutes for their opening pitch.' },
  { title: 'One minute to rebut', body: 'Each speaker gets one minute to respond to the opposing side.' },
  { title: 'Draw your stance on the spot', body: 'Stances are allocated by draw at the start of the round.' },
  { title: 'Trio participation', body: 'Teams of three compete together.' },
]

const SEMINAR = {
  slug: 'from-campus-to-product-companies',
  name: 'From Campus to Product Companies',
  tagline: null,
  shortDescription:
    'Professional speaker sessions on what it takes to move from campus work to a product company.',
  description: `A series of sessions from practitioners on the skills that transfer from campus to a product company: data structures and interview preparation, web development, and competitive programming.

Speakers and session timings are configured by the organizers.`,
  eventType: 'seminar',
  lifecycle: 'upcoming',
  isPublished: true,
  registrationOpen: false,
}

const SEMINAR_SESSIONS = [
  {
    speaker: { name: 'Mukesh Kumar Singh', title: null, organization: null, bio: null },
    title: 'DSA and preparation for product companies',
  },
  {
    speaker: { name: 'Vinit Shahdeo', title: null, organization: null, bio: null },
    title: 'Web development',
  },
  {
    speaker: { name: 'Akshay Jain', title: null, organization: null, bio: null },
    title: 'ICPC and competitive programming',
  },
]

async function ensureEvent(db, seed) {
  const existing = await db.get('SELECT * FROM events WHERE slug = ?', [seed.slug])
  if (existing) return alignEvent(db, existing, seed)

  const result = await db.run(
    `INSERT INTO events
       (slug, name, tagline, short_description, description, event_type, lifecycle,
        is_published, registration_open, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.slug,
      seed.name,
      seed.tagline,
      seed.shortDescription,
      seed.description,
      seed.eventType,
      seed.lifecycle,
      seed.isPublished,
      seed.registrationOpen,
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  )

  return db.get('SELECT * FROM events WHERE id = ?', [result.id])
}

/**
 * Fills in seed values that are still at their untouched defaults. A field the
 * organizer has already changed is left exactly as they set it.
 */
async function alignEvent(db, row, seed) {
  const updates = []
  if (row.event_type === 'other' && seed.eventType !== 'other') updates.push(['event_type', seed.eventType])
  if (row.lifecycle === 'draft' && seed.lifecycle !== 'draft') updates.push(['lifecycle', seed.lifecycle])
  if (!row.is_published && seed.isPublished) updates.push(['is_published', true])
  if (!row.registration_open && seed.registrationOpen) updates.push(['registration_open', true])
  if (!row.short_description && seed.shortDescription) updates.push(['short_description', seed.shortDescription])
  if (!row.description && seed.description) updates.push(['description', seed.description])

  if (!updates.length) return row

  await db.run(
    `UPDATE events SET ${updates.map(([column]) => `${column} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...updates.map(([, value]) => value), new Date().toISOString(), row.id],
  )

  return db.get('SELECT * FROM events WHERE id = ?', [row.id])
}

async function ensureSettings(db, eventId, settings) {
  const existing = await db.get('SELECT event_id FROM event_registration_settings WHERE event_id = ?', [
    eventId,
  ])
  if (existing) {
    // Keep fee/capacity edits made by organizers; only backfill the text.
    await db.run(
      `UPDATE event_registration_settings
          SET payment_instructions = COALESCE(payment_instructions, ?)
        WHERE event_id = ?`,
      [settings.paymentInstructions, eventId],
    )
    return
  }

  await db.run(
    `INSERT INTO event_registration_settings
       (event_id, enabled, is_paid, fee_minor, currency, capacity, inventory_unit,
        registration_mode, min_team_size, max_team_size, pending_hold_minutes,
        payment_instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      settings.enabled,
      settings.isPaid,
      settings.feeMinor,
      settings.currency,
      settings.capacity,
      settings.inventoryUnit,
      settings.registrationMode,
      settings.minTeamSize,
      settings.maxTeamSize,
      settings.pendingHoldMinutes,
      settings.paymentInstructions,
    ],
  )
}

async function seedList(db, table, eventId, rows, { orderColumn = 'sort_order' } = {}) {
  const count = (await db.get(`SELECT COUNT(*) AS count FROM ${table} WHERE event_id = ?`, [eventId]))
    .count
  if (count > 0) return

  for (const [index, row] of rows.entries()) {
    const columns = Object.keys(row)
    const values = Object.values(row)
    await db.run(
      `INSERT INTO ${table} (event_id, ${columns.join(', ')}, ${orderColumn})
       VALUES (?, ${columns.map(() => '?').join(', ')}, ?)`,
      [eventId, ...values, index],
    )
  }
}

/**
 * Links the pre-existing C³ signups to participant records so those people see
 * their own history in the dashboard. Their status stays 'registered' — the
 * legacy form never verified a payment, and the platform will not pretend it did.
 */
async function backfillLegacyRegistrations(db) {
  const rows = await db.all(
    `SELECT r.id, r.full_name, r.campus, r.user_id, u.email
       FROM registrations r
       JOIN users u ON u.id = r.user_id
      WHERE r.participant_id IS NULL`,
  )

  for (const row of rows) {
    let participant = await db.get('SELECT * FROM participants WHERE lower(email) = lower(?)', [
      row.email,
    ])

    if (!participant) {
      const result = await db.run(
        `INSERT INTO participants (email, full_name, campus, user_id, claimed_at)
         VALUES (?, ?, ?, ?, ?)`,
        [row.email, row.full_name, row.campus, row.user_id, new Date().toISOString()],
      )
      participant = await db.get('SELECT * FROM participants WHERE id = ?', [result.id])
    }

    await db.run(
      `UPDATE registrations
          SET participant_id = ?, is_captain = TRUE, updated_at = ?
        WHERE id = ?`,
      [participant.id, new Date().toISOString(), row.id],
    )
  }

  if (rows.length) console.log(`[db] linked ${rows.length} legacy registration(s) to participants.`)
}

/** Existing organizer accounts become explicit organizer grants. */
async function seedOrganizerGrants(db) {
  const organizers = await db.all("SELECT id, role FROM users WHERE role IN ('organizer', 'admin')")
  for (const user of organizers) {
    await db.run(
      `INSERT INTO organizer_grants (user_id) VALUES (?)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    )
  }
}

export async function seedPlatform(db) {
  if (!db.platform) return null

  const c3 = await ensureEvent(db, C3)

  // One-time tagline correction from the original brand line to the event line.
  if (c3.tagline === 'Where ideas take shape.') {
    await db.run('UPDATE events SET tagline = ? WHERE id = ?', [C3.tagline, c3.id])
  }

  await ensureSettings(db, c3.id, C3_SETTINGS)
  await seedList(
    db,
    'event_domains',
    c3.id,
    C3_DOMAINS.map((title) => ({ title })),
  )

  const rhetoric = await ensureEvent(db, RHETORIC)
  await seedList(
    db,
    'event_rules',
    rhetoric.id,
    RHETORIC_RULES.map((rule) => ({ section: 'format', ...rule })),
  )

  const seminar = await ensureEvent(db, SEMINAR)
  for (const session of SEMINAR_SESSIONS) {
    const existing = await db.get('SELECT id FROM event_sessions WHERE event_id = ? AND title = ?', [
      seminar.id,
      session.title,
    ])
    if (existing) continue

    let speaker = await db.get('SELECT id FROM speakers WHERE name = ?', [session.speaker.name])
    if (!speaker) {
      const created = await db.run(
        'INSERT INTO speakers (name, title, organization, bio) VALUES (?, ?, ?, ?)',
        [session.speaker.name, session.speaker.title, session.speaker.organization, session.speaker.bio],
      )
      speaker = { id: created.id }
    }

    await db.run(
      `INSERT INTO event_speakers (event_id, speaker_id, sort_order)
       VALUES (?, ?, ?) ON CONFLICT (event_id, speaker_id) DO NOTHING`,
      [seminar.id, speaker.id, 0],
    )

    await db.run(
      'INSERT INTO event_sessions (event_id, title, speaker_id, sort_order) VALUES (?, ?, ?, ?)',
      [seminar.id, session.title, speaker.id, 0],
    )
  }

  await backfillLegacyRegistrations(db)
  await seedOrganizerGrants(db)

  return c3
}
