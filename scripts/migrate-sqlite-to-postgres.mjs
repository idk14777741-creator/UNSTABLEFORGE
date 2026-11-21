#!/usr/bin/env node
/**
 * SQLite → PostgreSQL migration for UNSTABLE FORGE.
 *
 *   npm run migrate:postgres -- --dry-run
 *   DATABASE_URL=postgres://… npm run migrate:postgres
 *
 * Safety
 *   * Checkpoints WAL and copies the SQLite file (plus -wal/-shm) to
 *     server/data/backups/ before reading anything.
 *   * Refuses to run against a PostgreSQL database that already holds users.
 *   * Runs inside one transaction: a failure rolls back completely.
 *   * Preserves primary keys, timestamps, password hashes and relationships.
 *   * Verifies row counts and foreign keys before committing.
 *
 * Rollback: the SQLite file is never modified. To return to it, unset
 * DATABASE_URL (the API then uses server/data/unstable-forge.db again). To
 * discard a PostgreSQL attempt, drop that database and re-run the migration.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadEnv } from '../server/env.js'

// Real environment variables win; .env fills in the rest.
loadEnv()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const databaseUrl = process.env.DATABASE_URL || readArg('--database-url')
const sqlitePath = path.resolve(
  process.env.SQLITE_PATH || process.env.DATABASE_PATH || 'server/data/unstable-forge.db',
)

function readArg(flag) {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1]
}

function fail(message) {
  console.error(`[migrate] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(sqlitePath)) fail(`SQLite database not found at ${sqlitePath}.`)
if (!dryRun && !databaseUrl) {
  fail(
    'DATABASE_URL is required for a real migration. Example:\n' +
      '  DATABASE_URL=postgres://user:pass@host:5432/unstableforge npm run migrate:postgres',
  )
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = path.resolve('server/data/backups')
fs.mkdirSync(backupDir, { recursive: true })
const backupPath = path.join(backupDir, `sqlite-pre-postgres-${timestamp}.db`)

const Database = (await import('better-sqlite3')).default

// WAL: committed rows can still live in the -wal file, so checkpoint first.
{
  const writable = new Database(sqlitePath)
  writable.pragma('wal_checkpoint(TRUNCATE)')
  writable.close()
}

fs.copyFileSync(sqlitePath, backupPath)
for (const suffix of ['-wal', '-shm']) {
  const sidecar = `${sqlitePath}${suffix}`
  if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${backupPath}${suffix}`)
}
console.log(`[migrate] Backup written to ${backupPath}`)

const source = new Database(sqlitePath, { readonly: true })
const read = (sql) => source.prepare(sql).all()

const legacyUsers = read('SELECT id, email, password_hash, role, created_at FROM users ORDER BY id')
const legacyEvents = read('SELECT id, slug, name, tagline, created_at FROM events ORDER BY id')
const legacyAnnouncements = read('SELECT * FROM announcements ORDER BY id')
const legacyRegistrations = read('SELECT * FROM registrations ORDER BY id')
const legacyProjects = read('SELECT * FROM projects ORDER BY id')

if (!legacyEvents.length) fail('No event row found in SQLite; nothing to anchor the migration.')

const summary = {
  users: legacyUsers.length,
  events: legacyEvents.length,
  announcements: legacyAnnouncements.length,
  registrations: legacyRegistrations.length,
  projects: legacyProjects.length,
}

console.log('[migrate] Source counts:', summary)

if (dryRun) {
  console.log('[migrate] Dry run — no changes made. Tables will be created by server/db/schema.postgres.sql.')
  process.exit(0)
}

const { default: pg } = await import('pg').catch(() => {
  fail('The "pg" package is not installed. Run `npm install pg` first.')
})

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

const schemaSql = fs.readFileSync(path.resolve('server/db/schema.postgres.sql'), 'utf8')

try {
  await client.query('BEGIN')

  const existing = await client.query("SELECT to_regclass('public.users') AS present")
  if (existing.rows[0]?.present) {
    const count = await client.query('SELECT COUNT(*)::int AS c FROM users')
    if (count.rows[0].c > 0) {
      fail('Target database already contains users. Refusing to migrate into a non-empty database.')
    }
  }

  await client.query(schemaSql)

  for (const user of legacyUsers) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, user.password_hash, user.role || 'participant', user.created_at],
    )
  }

  for (const event of legacyEvents) {
    await client.query(
      `INSERT INTO events (id, slug, name, tagline, created_at)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [event.id, event.slug, event.name, event.tagline, event.created_at],
    )
  }

  for (const row of legacyAnnouncements) {
    await client.query(
      `INSERT INTO announcements
         (id, event_id, title, slug, content, category, published_at, is_published,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.event_id,
        row.title,
        row.slug,
        row.content,
        row.category,
        row.published_at,
        Boolean(row.is_published),
        row.created_at,
        row.updated_at,
      ],
    )
  }

  for (const row of legacyRegistrations) {
    await client.query(
      `INSERT INTO registrations (id, event_id, user_id, full_name, campus, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.event_id, row.user_id, row.full_name, row.campus, row.created_at],
    )
  }

  for (const row of legacyProjects) {
    await client.query(
      `INSERT INTO projects
         (id, event_id, user_id, title, slug, tagline, description, category,
          technologies, team_name, repo_url, demo_url, cover_image_url, status,
          created_at, updated_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.event_id,
        row.user_id,
        row.title,
        row.slug,
        row.tagline,
        row.description,
        row.category,
        row.technologies || '[]',
        row.team_name,
        row.repo_url,
        row.demo_url,
        row.cover_image_url,
        row.status,
        row.created_at,
        row.updated_at,
        row.published_at,
      ],
    )
  }

  for (const table of ['users', 'events', 'announcements', 'registrations', 'projects']) {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('${table}', 'id'),
         COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
         false
       )`,
    )
  }

  // ------------------------------------------------------------ verification
  const problems = []
  const verified = {}

  for (const [table, expected] of Object.entries(summary)) {
    const actual = (await client.query(`SELECT COUNT(*)::int AS c FROM ${table}`)).rows[0].c
    verified[table] = actual
    if (actual !== expected) problems.push(`${table}: expected ${expected}, found ${actual}`)
  }

  const orphanRegistrations = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM registrations r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN events e ON e.id = r.event_id
      WHERE u.id IS NULL OR e.id IS NULL`,
  )
  if (orphanRegistrations.rows[0].c > 0) {
    problems.push(`${orphanRegistrations.rows[0].c} registrations lost their user or event link`)
  }

  const orphanAnnouncements = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM announcements a LEFT JOIN events e ON e.id = a.event_id WHERE e.id IS NULL`,
  )
  if (orphanAnnouncements.rows[0].c > 0) {
    problems.push(`${orphanAnnouncements.rows[0].c} announcements lost their event link`)
  }

  const organisers = await client.query(
    "SELECT COUNT(*)::int AS c FROM users WHERE role IN ('organizer','admin')",
  )
  const legacyOrganisers = legacyUsers.filter((user) => user.role !== 'participant').length
  if (organisers.rows[0].c !== legacyOrganisers) {
    problems.push(
      `organizer accounts: expected ${legacyOrganisers}, found ${organisers.rows[0].c}`,
    )
  }

  const hashed = await client.query(
    "SELECT COUNT(*)::int AS c FROM users WHERE password_hash LIKE 'scrypt$%'",
  )
  if (hashed.rows[0].c !== legacyUsers.length) {
    problems.push('some password hashes were not preserved verbatim')
  }

  if (problems.length) throw new Error(`Verification failed:\n  - ${problems.join('\n  - ')}`)

  await client.query(
    `INSERT INTO schema_migrations (version) VALUES ('002_sqlite_data')
     ON CONFLICT (version) DO NOTHING`,
  )

  await client.query('COMMIT')

  const reportPath = path.join(backupDir, `migration-report-${timestamp}.json`)
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        migratedAt: new Date().toISOString(),
        sqlitePath,
        backupPath,
        counts: verified,
        passwordHashesPreserved: hashed.rows[0].c,
        organizerAccounts: organisers.rows[0].c,
      },
      null,
      2,
    ),
  )

  console.log('[migrate] Verified counts:', verified)
  console.log(`[migrate] Committed. Report: ${reportPath}`)
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('[migrate] Migration failed and was rolled back:', error.message)
  process.exitCode = 1
} finally {
  await client.end()
  source.close()
}
