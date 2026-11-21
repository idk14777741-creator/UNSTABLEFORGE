# Database — PostgreSQL

## Engines

| `DATABASE_URL` | Engine | Use |
| --- | --- | --- |
| set | PostgreSQL (pooled, `pg`) | Primary. Development here, production everywhere else. |
| unset | SQLite (`server/data/unstable-forge.db`) | Local fallback, and the source of the migration. |

The same SQL runs on both. `server/db/index.js` rewrites `?` placeholders to
`$1..$n`, appends `RETURNING id` to inserts, and rewrites `LIKE` to `ILIKE` on
PostgreSQL. Route handlers are async and always await the driver.

Schema files:

- `server/db/schema.postgres.sql` — applied idempotently at startup
- `server/db/schema.sqlite.sql` — same shape for SQLite
- `server/db/schema.platform.sql` — the planned multi-event schema (not applied yet)

## Local PostgreSQL (₹0, no account)

`embedded-postgres` ships a real PostgreSQL 18 binary and runs it locally.

```bash
npm run db:local      # starts PostgreSQL on 127.0.0.1:54329, data in server/data/pgdata
```

Then `.env`:

```
DATABASE_URL=postgres://forge:forge_local_dev@127.0.0.1:54329/unstableforge
```

The credentials are a throwaway local cluster created by `scripts/pg-local.mjs`;
they are not used anywhere else and are never committed. Stop the process to
shut it down — the data directory persists between runs.

### Production

Any PostgreSQL 13+ works: a managed free tier, or a server you already run.
Set `DATABASE_URL` (and `PGSSLMODE=require` when the host requires TLS) in the
deployment platform's environment variables. Nothing else changes.

The API refuses to start when `DATABASE_URL` is set but unreachable, and it
refuses to start in production with neither `DATABASE_URL` nor a SQLite file.

## Migration

```bash
npm run migrate:postgres -- --dry-run          # counts only, no writes
npm run migrate:postgres                        # uses DATABASE_URL
```

What it does:

1. Checkpoints SQLite's WAL and copies `.db` + `-wal`/`-shm` to
   `server/data/backups/` with a timestamp.
2. Refuses to run if the target already has users.
3. Runs the PostgreSQL schema.
4. Copies `users`, `events`, `announcements`, `registrations`, `projects` —
   preserving IDs, timestamps, password hashes and foreign keys.
5. Resets every identity sequence to `MAX(id) + 1`.
6. Verifies row counts, orphaned rows, organizer count and that every password
   hash still starts with `scrypt$`.
7. Commits, or rolls back everything on any mismatch.
8. Writes `server/data/backups/migration-report-<timestamp>.json`.

### Rollback

The SQLite file is never modified.

- **Return to SQLite:** remove or comment `DATABASE_URL` and restart the API.
- **Discard a PostgreSQL attempt:** drop that database, re-run the migration.
- **Restore the snapshot:** copy the timestamped backup over
  `server/data/unstable-forge.db` (and remove stale `-wal`/`-shm` files).

### Verified migration (2026-11-21)

| Table | Migrated |
| --- | --- |
| users | 16 |
| events | 1 |
| announcements | 15 |
| registrations | 9 |
| projects | 0 |

Password hashes preserved: 16/16. Organizer accounts: 1. Foreign keys: intact.
The full API suite (96 checks) passes against PostgreSQL.

## Health

`GET /api/health` reports the engine, database name, server version and query
latency, and returns 503 when the database stops answering. It never exposes
the connection string.
