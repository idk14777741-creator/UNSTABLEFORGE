/**
 * Local PostgreSQL for development and tests.
 *
 * Spawns a real PostgreSQL 18 cluster from the `embedded-postgres` package —
 * no account, no billing, no Docker. Data lives in server/data/pgdata and
 * survives restarts. This is a *development* convenience only: production uses
 * whatever DATABASE_URL the operator supplies.
 *
 *   npm run db:local        # start (keeps running)
 */
import fs from 'node:fs'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

const databaseDir = path.resolve(process.env.PGDATA_DIR || 'server/data/pgdata')
const port = Number(process.env.PGPORT || 54329)
const user = process.env.PGUSER || 'forge'
const password = process.env.PGPASSWORD || 'forge_local_dev'
const database = process.env.PGDATABASE || 'unstableforge'

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true,
  autoRehydrateSymlinks: true,
  onLog: (message) => {
    if (/ready to accept connections|database system is ready/i.test(message)) {
      console.log('[pg-local] ready')
    }
  },
  onError: (message) => console.error('[pg-local]', message?.message || message),
})

const initialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'))
if (!initialised) {
  console.log('[pg-local] initialising cluster in', databaseDir)
  await pg.initialise()
}

await pg.start()

try {
  await pg.createDatabase(database)
  console.log(`[pg-local] created database "${database}"`)
} catch (error) {
  if (!/already exists/i.test(String(error?.message))) throw error
}

// Deliberately prints no credentials. The connection string lives in .env.
console.log(`[pg-local] listening on 127.0.0.1:${port} (database: ${database}, user: ${user})`)
console.log('[pg-local] DATABASE_URL is configured in .env — see .env.example')

let stopping = false
async function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(`[pg-local] ${signal} received, stopping cluster`)
  await pg.stop().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Keep the process (and therefore the cluster) alive.
await new Promise(() => {})
