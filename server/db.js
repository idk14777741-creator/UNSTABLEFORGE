import { openDatabase } from './db/index.js'
import { hashPassword } from './auth.js'
import { seedPlatform } from './platform/seed.js'

/**
 * Application database entry point.
 *
 * Engine selection lives in server/db/index.js: PostgreSQL when DATABASE_URL is
 * set, otherwise the existing SQLite file. Seeding is idempotent and never
 * overwrites existing rows.
 */
export const db = await openDatabase()

const now = () => new Date().toISOString()

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export const EVENT = {
  slug: 'c3-crescent-code-clash',
  name: 'C³ — Crescent Code Clash',
  tagline: 'Where ideas take shape.',
}

async function seedEvent() {
  const existing = await db.get('SELECT * FROM events WHERE slug = ?', [EVENT.slug])
  if (existing) return existing

  await db.run('INSERT INTO events (slug, name, tagline, created_at) VALUES (?, ?, ?, ?)', [
    EVENT.slug,
    EVENT.name,
    EVENT.tagline,
    now(),
  ])

  return db.get('SELECT * FROM events WHERE slug = ?', [EVENT.slug])
}

export const event = await seedEvent()

async function seedOrganizer() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''

  if (!email || !password) {
    console.warn(
      '[db] ADMIN_EMAIL / ADMIN_PASSWORD not set — no organizer account was seeded.',
    )
    return
  }

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return

  await db.run('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)', [
    email,
    hashPassword(password),
    'organizer',
    now(),
  ])
  console.log(`[db] Seeded organizer account for ${email}.`)
}

await seedOrganizer()

const seedAnnouncements = [
  {
    title: 'Announcements are now live',
    category: 'General',
    days: 0,
    content: `This is the first dispatch from Unstable Forge. From here on, event updates for C³ — Crescent Code Clash will be published in one place instead of being scattered across messages and screenshots.

Nothing about registration, tracks, or the schedule has been confirmed yet. When something is final, it will appear here with a category and a date.

For now, treat this space as the source of truth for what is known — and for what is still being decided.`,
  },
  {
    title: 'Registration has not opened yet',
    category: 'Registration',
    days: 1,
    content: `There is no registration form to fill in yet. The registration window, eligibility rules, and the official sign-up route are still being confirmed.

No date has been set for when registration opens. When it is, the announcement will include the exact window and what you need to prepare.

Please do not send registration details or personal information through unofficial channels.`,
  },
  {
    title: 'Tracks are still being forged',
    category: 'Competition',
    days: 2,
    content: `The official tracks and problem statements for C³ are not final. We are still shaping a brief that is specific enough to build against and open enough to leave room for unexpected ideas.

The tracks section of the website currently shows placeholders on purpose. It will be updated when the brief is approved, and not before.

We would rather publish a considered brief late than a vague one early.`,
  },
  {
    title: 'How the event day is taking shape',
    category: 'Schedule',
    days: 3,
    content: `The working sequence for C³ is simple: arrive, receive the brief, build, submit, and present. The order is planned; the timings are not.

No start time, end time, or venue has been confirmed. Those details depend on approvals that are still in progress.

When the schedule is locked, this announcement will be updated with the confirmed timings and location. Until then, any schedule you see elsewhere is provisional or incorrect.`,
  },
  {
    title: "Why we're building C³ as a build-first event",
    category: 'General',
    days: 4,
    content: `C³ is designed around the distance between an idea and a working thing. The brief, the format, and the judging will all point at the same question: did you make something real?

That does not mean polished. It means honest — a small, working, demonstrable version of an idea rather than a large presentation about one.

The event is being developed as part of the ALTA BUILDER 30 challenge, with ALTA campus students as the first audience.`,
  },
  {
    title: 'Eligibility: what we can confirm so far',
    category: 'Important',
    days: 5,
    content: `C³ is being designed for students across ALTA campuses. That is the intended audience, but the formal eligibility criteria are still being confirmed.

We have not published a final rule on enrollment status, campus, or year of study. When those criteria are approved, they will be listed in the participation section and in a dedicated announcement.

If your eligibility depends on a specific detail, wait for the confirmed criteria before making plans.`,
  },
  {
    title: 'Team formation is still being decided',
    category: 'Registration',
    days: 6,
    content: `We are still deciding whether C³ will support individual registration, team registration, or both — and what the final team-size range should be.

That decision affects how registration works, so it will be announced before the registration window opens, not after.

No team codes or invitations are being issued yet.`,
  },
  {
    title: "What we're looking for in a submission",
    category: 'Competition',
    days: 7,
    content: `The judging criteria are being finalized. The direction is clear: we want to see working software, a coherent idea, and evidence that the team understood the problem it chose.

Repositories and demo links will matter. Slide decks will not replace a running project.

The full criteria, including how each part is weighted, will be published with the official tracks.`,
  },
  {
    title: 'Venue, format and timings: still to be announced',
    category: 'Schedule',
    days: 8,
    content: `The venue has not been confirmed. Neither has the event format or the length of the build window.

We know this is the detail everyone wants first. It is also the detail we cannot responsibly publish until it is locked.

The DATE, VENUE, and FORMAT fields on the website will change from “TO BE ANNOUNCED” as soon as the confirmed information is available.`,
  },
  {
    title: 'No prize amounts have been confirmed yet',
    category: 'Important',
    days: 9,
    content: `There are no confirmed prize amounts, sponsor commitments, or award categories for C³.

The prize section of the website shows “TBA” because that is the accurate status. We will not publish a number or a sponsor name until it is confirmed in writing.

Recognition may include more than a prize pool, but the structure is still being discussed.`,
  },
  {
    title: 'A note on the build window',
    category: 'Schedule',
    days: 10,
    content: `The build window is one of the defining constraints of a hackathon. We are still deciding how long it should be for C³.

A shorter window rewards focus and preparation. A longer one allows more ambitious work but demands better scope control. Both are being weighed against the venue and schedule.

The final duration will be published with the event timeline.`,
  },
  {
    title: 'Following updates from the forge',
    category: 'General',
    days: 11,
    content: `Announcements are organized by category so you can follow the parts of the event you care about: registration, schedule, competition, and important notices.

Search will find an update by its title or its content. If you are looking for a specific decision, try the exact term you remember.

Social channels are not live yet. Until they are, this page is the canonical place for C³ updates.`,
  },
]

const seedDrafts = [
  {
    title: '[Draft] Registration launch checklist',
    category: 'Registration',
    content: `Internal draft. Confirm the registration window, eligibility text, team rules, and the official sign-up link before publishing.

This draft is intentionally unpublished and must not appear on the public site.`,
  },
  {
    title: '[Draft] Opening session run of show',
    category: 'Schedule',
    content: `Internal draft. Confirm the venue, arrival window, opening remarks, and brief release time before this is published.

This draft is intentionally unpublished and must not appear on the public site.`,
  },
]

function slugifyAnnouncement(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
}

async function seedContent() {
  const count = (await db.get('SELECT COUNT(*) AS count FROM announcements')).count
  if (count > 0) return

  const used = new Set()

  const uniqueSlug = (title) => {
    const base = slugifyAnnouncement(title) || 'announcement'
    let slug = base
    let suffix = 2
    while (used.has(slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }
    used.add(slug)
    return slug
  }

  await db.withTransaction(async (trx) => {
    for (const item of seedAnnouncements) {
      const publishedAt = daysAgo(item.days)
      await trx.run(
        `INSERT INTO announcements
           (event_id, title, slug, content, category, published_at, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          item.title,
          uniqueSlug(item.title),
          item.content,
          item.category,
          publishedAt,
          true,
          publishedAt,
          publishedAt,
        ],
      )
    }

    for (const item of seedDrafts) {
      const createdAt = daysAgo(2)
      await trx.run(
        `INSERT INTO announcements
           (event_id, title, slug, content, category, published_at, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          item.title,
          uniqueSlug(item.title),
          item.content,
          item.category,
          null,
          false,
          createdAt,
          createdAt,
        ],
      )
    }
  })

  console.log(`[db] Seeded ${seedAnnouncements.length + seedDrafts.length} announcements.`)
}

await seedContent()

async function ensureRegistrationAnnouncement() {
  const slug = 'registration-is-now-open'
  const existing = await db.get('SELECT id FROM announcements WHERE slug = ?', [slug])
  if (existing) return

  const timestamp = now()
  await db.run(
    `INSERT INTO announcements
       (event_id, title, slug, content, category, published_at, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      'Registration is now open',
      slug,
      `The C³ registration desk is open. Participants can create an account and register through the event site.

Registration currently collects your full name, account email, and campus. Event dates, venue, format, eligibility criteria, and team rules are still being confirmed and remain marked as TBA across the site.

Registering records your participation details and gives you a registration reference. It does not confirm event logistics that have not been announced.`,
      'Registration',
      timestamp,
      true,
      timestamp,
      timestamp,
    ],
  )
  console.log('[db] Seeded the registration-open announcement.')
}

await ensureRegistrationAnnouncement()

// Multi-event platform: event configuration, initial events, participant links.
await seedPlatform(db)
