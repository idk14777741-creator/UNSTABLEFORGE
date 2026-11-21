/**
 * Database driver layer.
 *
 * One async API over two engines:
 *   * PostgreSQL  — used whenever DATABASE_URL is set (primary target)
 *   * SQLite      — local fallback through better-sqlite3 (existing data)
 *
 * Application SQL is written once with `?` placeholders. The PostgreSQL driver
 * rewrites them to $1..$n and appends `RETURNING id` to inserts so callers get
 * the same `{ id, changes }` shape from both engines.
 *
 * Rules kept deliberately simple:
 *   * no ORM, no query builder — the project already uses plain SQL;
 *   * every multi-step write goes through `withTransaction`;
 *   * booleans are bound as booleans and normalised per driver.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

export class DatabaseUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DatabaseUnavailableError'
    this.code = 'DATABASE_UNAVAILABLE'
  }
}

/** `?` → `$1` … `$n`, skipping anything inside quotes. */
export function toPostgresPlaceholders(sql) {
  let index = 0
  let output = ''
  let quote = null

  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position]

    if (quote) {
      output += character
      if (character === quote && sql[position - 1] !== '\\') quote = null
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      output += character
      continue
    }

    if (character === '?') {
      index += 1
      output += `$${index}`
      continue
    }

    output += character
  }

  return output
}

function normaliseSqliteParam(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value instanceof Date) return value.toISOString()
  if (value === undefined) return null
  return value
}

// pg maps `undefined` to NULL only by accident; be explicit about it.
const normalisePostgresParam = (value) => value ?? null

const INSERT_PATTERN = /^\s*insert\s+into/i

function withReturning(sql) {
  if (!INSERT_PATTERN.test(sql)) return sql
  if (/\breturning\b/i.test(sql)) return sql
  return `${sql.replace(/;\s*$/, '')} RETURNING id`
}

// ------------------------------------------------------------------- SQLite

async function createSqliteDriver(databasePath) {
  // Deliberately synchronous underneath, async at the boundary so route code is
  // engine-agnostic.
  const { default: Database } = await import('better-sqlite3')

  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const handle = new Database(databasePath)
  handle.pragma('journal_mode = WAL')
  handle.pragma('foreign_keys = ON')

  const bind = (params) => params.map(normaliseSqliteParam)

  const driver = {
    engine: 'sqlite',
    label: 'SQLite',
    // SQLite's LIKE is case-insensitive for ASCII; this keeps parity with Postgres.
    likeOperator: 'LIKE',
    exec: async (sql) => {
      handle.exec(sql)
    },
    all: async (sql, params = []) => handle.prepare(sql).all(...bind(params)),
    get: async (sql, params = []) => handle.prepare(sql).get(...bind(params)) ?? null,
    run: async (sql, params = []) => {
      const result = handle.prepare(sql).run(...bind(params))
      return { id: Number(result.lastInsertRowid), changes: result.changes }
    },
    withTransaction: async (work) => {
      handle.exec('BEGIN IMMEDIATE')
      try {
        const result = await work(driver)
        handle.exec('COMMIT')
        return result
      } catch (error) {
        handle.exec('ROLLBACK')
        throw error
      }
    },
    close: async () => handle.close(),
  }

  return driver
}

// ---------------------------------------------------------------- PostgreSQL

async function createPostgresDriver(databaseUrl) {
  const { default: pg } = await import('pg')

  // int8 → Number: IDs and COUNT(*) stay usable in arithmetic. Safe for values
  // below 2^53, which covers any realistic row id here.
  pg.types.setTypeParser(20, (value) => Number(value))
  pg.types.setTypeParser(1700, (value) => Number(value))

  const needsSsl =
    /sslmode=require|sslmode=verify/i.test(databaseUrl) || process.env.PGSSLMODE === 'require'

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'unstable-forge',
  })

  // A pool error must never crash the API process (managed hosts recycle conns).
  pool.on('error', (error) => {
    console.error('[db] idle PostgreSQL client error:', error.message)
  })

  // One statement adapter, bound either to the pool or to a transaction's
  // dedicated client, so the SQL rewriting rules exist in exactly one place.
  const statements = (executor) => {
    const send = (sql, params = []) =>
      executor.query(toPostgresPlaceholders(sql), params.map(normalisePostgresParam))

    return {
      exec: async (sql) => {
        await executor.query(sql)
      },
      all: async (sql, params = []) => (await send(sql, params)).rows,
      get: async (sql, params = []) => (await send(sql, params)).rows[0] ?? null,
      run: async (sql, params = []) => {
        const isInsert = INSERT_PATTERN.test(sql)
        const result = await send(isInsert ? withReturning(sql) : sql, params)
        return { id: isInsert ? (result.rows[0]?.id ?? null) : null, changes: result.rowCount }
      },
    }
  }

  const driver = {
    engine: 'postgres',
    label: 'PostgreSQL',
    likeOperator: 'ILIKE',
    ...statements(pool),
    withTransaction: async (work) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await work({ ...driver, ...statements(client) })
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
    close: async () => pool.end(),
  }

  return driver
}

// --------------------------------------------------------------------- setup

function readSchema(engine) {
  const file = engine === 'postgres' ? 'schema.postgres.sql' : 'schema.sqlite.sql'
  return fs.readFileSync(path.join(MODULE_DIR, file), 'utf8')
}

/**
 * Opens the configured database and applies the idempotent schema.
 * Throws DatabaseUnavailableError with an actionable message when the target
 * cannot be reached, so the API fails clearly instead of half-starting.
 */
export async function openDatabase() {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl) {
    let driver
    try {
      driver = await createPostgresDriver(databaseUrl)
      await driver.exec('SELECT 1')
    } catch (error) {
      throw new DatabaseUnavailableError(
        `Cannot reach the PostgreSQL database configured by DATABASE_URL: ${error.message}\n` +
          'Check the host, port, credentials and TLS mode, or unset DATABASE_URL to use local SQLite.',
      )
    }

    await driver.exec(readSchema('postgres'))
    console.log('[db] PostgreSQL ready')
    return driver
  }

  const databasePath =
    process.env.DATABASE_PATH || path.resolve(process.cwd(), 'server/data/unstable-forge.db')

  if (!fs.existsSync(databasePath) && process.env.NODE_ENV === 'production') {
    throw new DatabaseUnavailableError(
      `No database configured. Set DATABASE_URL for production, or place a SQLite file at ${databasePath}.`,
    )
  }

  const driver = await createSqliteDriver(databasePath)
  await driver.exec(readSchema('sqlite'))
  console.log(`[db] SQLite ready at ${databasePath} (set DATABASE_URL to use PostgreSQL)`)
  return driver
}

export async function checkDatabase(db) {
  const startedAt = Date.now()
  try {
    if (db.engine === 'postgres') {
      const row = await db.get(
        "SELECT current_database() AS name, current_setting('server_version') AS version",
      )
      return {
        ok: true,
        engine: 'postgres',
        database: row?.name ?? null,
        version: row?.version ?? null,
        latencyMs: Date.now() - startedAt,
      }
    }

    const row = await db.get('SELECT sqlite_version() AS version')
    return {
      ok: true,
      engine: 'sqlite',
      database: process.env.DATABASE_PATH || 'server/data/unstable-forge.db',
      version: row?.version ?? null,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      engine: db.engine,
      error: error.message,
      latencyMs: Date.now() - startedAt,
    }
  }
}
