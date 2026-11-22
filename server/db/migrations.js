/**
 * Numbered schema migrations.
 *
 * The parity schema (schema.postgres.sql / schema.sqlite.sql) is applied at
 * every boot because it is idempotent and describes the original application.
 * Everything after it is a migration: applied once, inside a transaction, and
 * recorded in schema_migrations so a restart never re-runs it.
 *
 * Platform migrations are PostgreSQL-only. The SQLite file remains the
 * documented rollback path for the original functionality; it is not upgraded.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

const MIGRATIONS = [
  { version: '002_platform', file: 'schema.platform.sql' },
  { version: '003_fee_unit', file: 'migrations/003_fee_unit.sql' },
  { version: '004_platform_controls', file: 'migrations/004_platform_controls.sql' },
  { version: '005_c3_domain_notes', file: 'migrations/005_c3_domain_notes.sql' },
  { version: '006_media_blobs', file: 'migrations/006_media_blobs.sql' },
]

export async function applyMigrations(db) {
  if (db.engine !== 'postgres') return []

  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  )

  const applied = new Set(
    (await db.all('SELECT version FROM schema_migrations')).map((row) => row.version),
  )

  const ran = []
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    const sql = fs.readFileSync(path.join(MODULE_DIR, migration.file), 'utf8')

    await db.withTransaction(async (trx) => {
      await trx.exec(sql)
      await trx.run(
        'INSERT INTO schema_migrations (version) VALUES (?) ON CONFLICT (version) DO NOTHING',
        [migration.version],
      )
    })

    ran.push(migration.version)
    console.log(`[db] applied migration ${migration.version}`)
  }

  return ran
}

export const PLATFORM_FEATURES = 'platform'
