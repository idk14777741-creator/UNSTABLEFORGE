# UNSTABLE FORGE — Platform Evolution

**Milestone 0 — audit, architecture and migration plan.**

Status: audit complete; target PostgreSQL schema and migration script written but **not applied**.
Nothing in the running application has been changed by this milestone: the homepage, the forge
sequence, every route and every existing record are untouched.

---

## 1. Existing architecture and verified functionality

Verified by reading the code and querying the live database, not from prior handoff notes.

| Layer | Reality |
| --- | --- |
| Frontend | React 19 + Vite 6, no router dependency — a hand-rolled history router in `src/lib/router.jsx`, route matching by regex inside `src/App.jsx` |
| Backend | Express 4, single file `server/index.js` (1,467 lines), 25 routes, `express.json({limit:'100kb'})` |
| Database | `better-sqlite3`, file `server/data/unstable-forge.db`, WAL, foreign keys ON, schema created imperatively in `server/db.js` |
| Auth | scrypt password hashes (`scrypt$salt$hash`), HMAC-SHA256 signed bearer tokens, 8-hour TTL, role claim inside the token |
| Design system | `src/styles.css` + layered CSS (`day10`, `day11`, `day12`, `announcements`, `auth`, `cinematic`, `constellation`) |
| Cinematic | `src/cinematic/*` — three.js forge (scenes 01–04), constellation (05–08), `StaticJourney` fallback |
| Static serving | Express serves `dist/` with an SPA fallback when the build exists; Vite proxies `/api` to `:4000` |

### Routes that exist today (verified)

Public: `GET /api/health`, `GET /api/announcements`, `GET /api/announcements/:identifier`,
`GET /api/projects`, `GET /api/projects/:identifier`, `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/signup`.

Participant (`requireAuth`): `GET /api/registrations/me`, `POST /api/registrations`,
`GET /api/projects/mine`, `GET /api/projects/mine/:id`, `POST /api/projects`,
`PATCH /api/projects/:id`, `DELETE /api/projects/:id`.

Organizer (`requireOrganizer`): `GET /api/admin/announcements`, `GET /api/admin/announcements/:id`,
`POST /api/announcements`, `PATCH /api/announcements/:id`, `DELETE /api/announcements/:id`,
`GET /api/admin/registrations`, `GET /api/admin/projects`, `PATCH /api/admin/projects/:id`.

Client routes: `/`, `/brief`, `/announcements`, `/announcements/:slug`, `/login`, `/signup`,
`/register`, `/projects`, `/projects/:slug`, `/projects/mine`, `/projects/submit`,
`/projects/:id/edit`, `/unauthorized`, `/admin`, `/admin/announcements`,
`/admin/announcements/new`, `/admin/announcements/:id/edit`, `/admin/registrations`,
`/admin/projects`, plus a 404.

### Live data in the SQLite file

| Table | Rows |
| --- | --- |
| users | 14 (1 organizer, 13 participants) |
| events | 1 (`c3-crescent-code-clash`) |
| registrations | 7 (all for event 1, all linked to a user) |
| announcements | 15 (13 published, 2 drafts) |
| projects | 0 |
| sqlite_sequence | 5 |

Important: **the current schema is single-event by construction.** `index.js` binds every query to
the `event` row exported by `db.js`; there is no `event_id` supplied by clients. Registration has no
status column at all — `serializeRegistration()` hardcodes `status: 'registered'`. There is no
payment, pass, attendance or certificate table. That is the entire scope of the change.

### Gaps against the brief (all confirmed, not assumed)

1. Registration is account-only, one seat per user, no team model, no capacity, no fee, no status.
2. Organizer access is a role claim inside a token with no second verification step and no audit log.
3. Login is functional, but there is **no** Google OAuth, no email verification, no password reset.
4. Announcements are event-scoped in the schema but event-locked in the API.
5. No upload pipeline at all — project `cover_image_url` is a URL string.
6. `Structure SQL` (the stray file at repo root) declares an unused `faqs` table; it is not applied.

---

## 2. Current SQLite schema and migration risks

### Schema as built (`server/db.js`)

```
events(id, slug UNIQUE, name, tagline, created_at)
users(id, email UNIQUE, password_hash, role DEFAULT 'organizer', created_at)
announcements(id, event_id→events CASCADE, title, slug UNIQUE, content, category,
              published_at, is_published, created_at, updated_at)
registrations(id, event_id→events CASCADE, user_id→users CASCADE,
              full_name, campus, created_at, UNIQUE(user_id, event_id))
projects(id, event_id→events CASCADE, user_id→users CASCADE, title, slug UNIQUE, tagline,
         description, category, technologies TEXT '[]', team_name, repo_url, demo_url,
         cover_image_url, status CHECK(draft|submitted|published|rejected),
         created_at, updated_at, published_at)
```

Indexes: `announcements(is_published, published_at DESC)`, `announcements(event_id)`,
`announcements(category)`, `registrations(event_id, created_at DESC)`,
`projects(status, published_at DESC)`, `projects(event_id)`, `projects(user_id)`.

Timestamps are ISO-8601 **text**. `technologies` is a JSON string. Booleans are `0/1`. There is one
`AUTOINCREMENT` sequence per table.

### Risks and how the plan handles each

| Risk | Handling |
| --- | --- |
| Timestamp text → `TIMESTAMPTZ` conversion shifts timezone | Source values are UTC ISO strings; inserted as-is, PostgreSQL parses them as UTC. Verified by comparing `to_char` output after migration. |
| `AUTOINCREMENT` IDs must survive | All IDs are inserted explicitly; every sequence is reset with `setval(..., MAX(id)+1, false)` afterwards. |
| `users.role` default is `'organizer'` — a new user created without an explicit role would be an organizer | The API always passes `'participant'` explicitly (verified in `POST /api/auth/signup`). The new schema defaults to `participant` and drops that trap. |
| `registrations` has no status; existing rows would silently become "confirmed" | Legacy rows are migrated as `pending_payment` with an `audit_logs` entry. **No QR passes are issued during migration.** Existing participants will appear as "awaiting confirmation" until an organizer verifies them. This is a deliberate product decision, not data loss. |
| Duplicate account claims via email case | New `users` and `participants` use a unique index on `lower(email)`; matching is by verified email only, never by name. |
| `SQLITE_CONSTRAINT*` error codes are checked in three places | The database layer must return a normalised `ConflictError`; those checks are replaced during the repository layer work, not left dangling. |
| SQLite `LIKE` is case-insensitive for ASCII, PostgreSQL `LIKE` is not | Every search predicate becomes `ILIKE` (or `lower(...) LIKE`); `COLLATE NOCASE` in the admin campus filter becomes `lower(campus) = lower($1)`. |
| `?` placeholders vs `$1` | One SQL dialect adapter, not 25 hand-rewrites. |
| `lastInsertRowid` | `INSERT ... RETURNING id`. |
| Synchronous `db.prepare().get()` API | The repository layer becomes async. Express handlers get a small `asyncHandler` wrapper; the existing error middleware still catches. |
| Two SQLite files in the repo history / a stale backup being promoted | Migration always snapshots to `server/data/backups/` and records a JSON report. |
| Running the app against a half-migrated database | The app refuses to start if `DATABASE_URL` is set but the schema version is missing, and logs a clear error otherwise. |

### Why PostgreSQL is not yet active here

This machine has **no PostgreSQL server and no Docker** (`psql`, `pg_ctl`, `pg_isready` and `docker`
are all absent; no Homebrew either). A migration cannot be honestly verified without a server, so:

* the schema and migration script are committed and dry-run tested,
* the running app stays on SQLite until a `DATABASE_URL` exists,
* nothing has been pointed at a production database.

To verify: provision PostgreSQL (local install, existing server, or a managed provider), then

```bash
npm install pg
DATABASE_URL=postgres://user:pass@host:5432/unstableforge npm run migrate:postgres --dry-run
DATABASE_URL=postgres://user:pass@host:5432/unstableforge npm run migrate:postgres
DATABASE_URL=postgres://user:pass@host:5432/unstableforge npm run server
npm run test:api
```

---

## 3. Proposed PostgreSQL schema and relationships

Defined in `server/schema.postgres.sql` (25 tables, 1 view, 40+ indexes).

```
users ──< organizer_grants
  │   └─< organizer_access_codes        (personal second factor, hashed)
  ├──< oauth_accounts                   (google sub → user)
  ├──< auth_tokens                      (email verify / password reset, hashed, single-use)
  ├──< participants.user_id             (claim link, nullable)
  └──< audit_logs.actor_user_id

events ─┬─ event_registration_settings  (1:1: fee, capacity, team limits, payment QR)
        ├─< event_domains               (hackathon challenge domains)
        ├─< event_topics                (debate topics)
        ├─< event_rules                 (free-form rule blocks, sectioned)
        ├─< event_speakers >── speakers
        ├─< event_sessions              (speaker_id, times, venue)
        ├─< event_criteria              (judging criteria, weights)
        ├─< event_faqs
        ├─< event_registration_fields   (custom form fields)
        ├─< teams
        ├─< payments
        ├─< registrations
        ├─< certificates / certificate_templates / event_rankings
        ├─< media_assets                (The Glimpse, hero, speakers, payment QR)
        ├─< announcements
        └─< projects

participants ─< registrations >── teams
                     │              └─ captain_participant_id
                     ├─ payment_id
                     ├─< passes ─< check_ins
                     └─< certificates
```

**Key decisions**

* **Registration = a seat.** `registrations` is one row per participant per event
  (`UNIQUE(event_id, participant_id)`), so capacity, passes, attendance and certificates all work
  identically for individual and team entries. A team of four is four seats sharing one `team_id`
  and one `payment_id`; `is_captain` marks the registrant.
* **Capacity is reserved by participants, not teams.** `registration_seat_usage` aggregates held and
  confirmed seats. A registration takes a seat only while `hold_expires_at` is in the future, so an
  abandoned payment releases capacity automatically.
* **Status is an explicit state machine**, not a boolean:
  `pending_payment → payment_submitted → verification_pending → confirmed`, with `cancelled`,
  `rejected`, `refunded`. Only `confirmed` issues a pass.
* **Lifecycle ≠ visibility ≠ registration.** Three independent columns on `events`
  (`lifecycle`, `is_published`, `registration_open`).
* **Deletion is archival.** No endpoint deletes events, registrations or certificates; `archived_at`
  and status fields carry the change, so history and issued certificates survive.
* **QR tokens are opaque.** `passes.token_hash` stores only a SHA-256 hash; `token_prefix` is a
  non-secret lookup aid. The raw token lives only in the pass the participant downloads.
* **Check-in corrections keep history.** `check_ins` rows are reverted (`reverted_at`,
  `reverted_by`, `revert_reason`), never deleted; a partial unique index allows exactly one active
  check-in per pass.
* **Audit everywhere it matters.** `audit_logs` records actor, event, action, entity and JSONB
  metadata for organizer mutations.

---

## 4. Proposed API changes

Existing contracts stay byte-compatible where possible; new capability is additive.

### Unchanged

`GET /api/health`, `GET /api/announcements`, `GET /api/announcements/:identifier`,
`GET /api/projects`, `GET /api/projects/:identifier`, `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/signup`, `GET/POST/PATCH/DELETE /api/projects*`,
`GET/POST/PATCH/DELETE /api/announcements*`, `GET /api/admin/projects`,
`PATCH /api/admin/projects/:id`, `GET /api/admin/registrations`.

`POST /api/registrations` (individual, legacy shape) keeps working and now writes a real
registration with status `pending_payment`.

### New — public

| Route | Purpose |
| --- | --- |
| `GET /api/events` | Published events with type, lifecycle, tags, next date, cover, seats left |
| `GET /api/events/:slug` | Full event page payload: config + type-specific modules |
| `GET /api/events/:slug/announcements` | Event-scoped updates |
| `GET /api/glimpse` | Published photographs, ordered, by placement |
| `GET /api/certificates/verify/:code` | Public certificate verification, minimal fields |
| `GET /api/auth/google/start`, `GET /api/auth/google/callback` | OAuth (structure only until credentials exist) |

### New — participant (`requireAuth`)

`GET /api/me/dashboard` (overview), `GET /api/me/registrations`, `GET /api/me/passes`,
`GET /api/me/certificates`, `PATCH /api/me`, `POST /api/me/claim` (email-verified claim),
`POST /api/events/:slug/registrations` (individual), `POST /api/events/:slug/teams`
(captain-led team), `POST /api/registrations/:id/payment` (submit UPI reference),
`GET /api/passes/:id`, `GET /api/passes/:id/download`, `GET /api/certificates/:id/pdf`.

### New — organizer (`requireOrganizer` + audit)

`POST /api/organizer/session` (second-factor verification), `GET /api/organizer/overview`,
`POST /api/organizer/events`, `PATCH /api/organizer/events/:id`,
`POST /api/organizer/events/:id/publish|unpublish|activate|deactivate|archive`,
`PUT /api/organizer/events/:id/registration-settings`,
CRUD for domains, topics, rules, criteria, FAQs, fields, speakers, sessions,
`GET /api/organizer/events/:id/registrations`, `PATCH /api/organizer/registrations/:id`,
`GET /api/organizer/events/:id/payments`, `POST /api/organizer/payments/:id/verify|reject`,
`POST /api/organizer/check-in` (token), `POST /api/organizer/check-ins/:id/revert`,
`GET /api/organizer/events/:id/attendance`,
`POST /api/organizer/events/:id/certificates/issue|revoke`,
`GET /api/organizer/events/:id/certificates`,
`POST /api/organizer/media` (multipart), `PATCH/DELETE /api/organizer/media/:id`,
`PATCH /api/organizer/media/:id/order`, `GET /api/organizer/events/:id/export`.

Error shape is unchanged: `{ error: { code, message, fields? } }`.

---

## 5. Proposed frontend route changes

Preserved exactly: `/`, `/brief`, `/announcements*`, `/login`, `/signup`, `/projects*`,
`/unauthorized`, `/admin/*`.

Added:

| Route | Content |
| --- | --- |
| `/events` | The Universe — event constellation in a standalone view |
| `/events/:slug` | Adaptive event page (hackathon / debate / seminar / workshop / competition modules) |
| `/events/:slug/register` | Individual or captain-led team registration |
| `/events/:slug/glimpse` | The Glimpse for that event (also embedded on the event page) |
| `/glimpse` | All published photography |
| `/dashboard` | Participant overview, events, passes, certificates, profile |
| `/dashboard/passes/:id` | Full-screen QR pass |
| `/dashboard/certificates/:id` | Certificate + download |
| `/verify/:code` | Public certificate verification |
| `/organizer` | Organizer overview |
| `/organizer/events`, `/organizer/events/new`, `/organizer/events/:id` | Event management |
| `/organizer/events/:id/registrations`, `/payments`, `/attendance`, `/certificates`, `/glimpse` | Event operations |
| `/organizer/scan` | QR check-in scanner (camera + manual fallback) |

`/admin` stays as an alias landing to `/organizer` so existing organizer bookmarks and tests do not
break. Existing `/register` becomes a redirect to the C³ registration page.

Navigation changes are limited to: the event status chip, the account menu (dashboard entry),
The Glimpse link, and the event constellation replacing the domain constellation on `/`.

---

## 6. External credentials and infrastructure required

| Need | Env vars | Status |
| --- | --- | --- |
| PostgreSQL | `DATABASE_URL` (+ `PGSSLMODE` for managed hosts) | **Not available on this machine** — must be supplied |
| Auth tokens | `AUTH_SECRET` (32+ chars) | Present |
| Organizer bootstrap | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Present |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | **Missing** — needs a Google Cloud OAuth client |
| UPI payment | `UPI_VPA`, `UPI_PAYEE_NAME`, payment QR image | **Missing** — owner supplies; no QR is invented |
| Uploads | `UPLOAD_DRIVER=local\|s3`, `UPLOAD_DIR`, `S3_*` | Local driver works; production object storage needs approval (cost) |
| Media processing | none (sharp optional) | Thumbnails via `sharp` if approved; otherwise CSS `srcset` from originals |

Nothing is committed. `.env.example` will document every variable; the app fails loudly when
`DATABASE_URL` or `AUTH_SECRET` is missing in the mode that requires them.

---

## 7. Safe, ordered implementation plan

**M0 — this milestone.** Audit, schema, migration script, plan. No destructive change. ✅

**M1 — database and core platform.**
1. `server/db/` driver layer: `sqlite.js` (sync, wrapped async) and `postgres.js` (`pg`), one query
   adapter handling placeholders, `RETURNING`, `ILIKE`, booleans, JSONB.
2. Repositories move out of `index.js`; handlers become async. Existing endpoints keep their
   response shapes, so `npm run test:api` must stay green on SQLite.
3. Roles: `organizer_grants` + `organizer_access_codes`; `POST /api/organizer/session` issues a
   short-lived organizer-scoped token; every organizer route re-checks the grant server-side.
4. Rate limiter for `login`, `signup`, `organizer/session`, `claim`, `check-in`.
5. Event CRUD API + registration settings + content modules.
6. Migration executed and verified against PostgreSQL, then `npm run test:api` re-run on PostgreSQL.

**M2 — multi-event experience.** Emblem becomes UNSTABLE FORGE; hammer gantry physically bolted to a
rail and frame; constellation re-sourced from `/api/events`; adaptive event pages; homepage
simplified to Forge → Universe → Event → Glimpse → Journey → Creations.

**M3 — registration and payments.** Individual and captain-led team registration, participant
claiming, seat-based capacity with atomic reservation, UPI reference submission, organizer
verification, on-site PAYMENT CONFIRMED message, pass issuance on confirmation only.

**M4 — QR attendance and certificates.** Individual passes, hashed tokens, organizer scanner,
server-side validation, check-in correction, certificate templates, PDF generation, public
verification.

**M5 — dashboards and The Glimpse.** Participant dashboard, organizer dashboard, uploads and
placements, parallax/zoom-out gallery, speaker and session management, analytics and CSV export.

**M6 — hardening.** The full test matrix from §21 of the brief, plus a visual regression pass on the
cinematic homepage at 1440×900 and 390×844, reduced-motion and no-WebGL fallbacks.

### Verification gate

No milestone is reported complete without an executed command behind it: `npm run test:api`,
`npm run build`, and — once a `DATABASE_URL` exists — the same suite against PostgreSQL with the
migration's count and relationship report attached.
