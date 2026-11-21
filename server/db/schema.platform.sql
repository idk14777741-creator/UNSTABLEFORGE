-- UNSTABLE FORGE — platform migration (PostgreSQL).
--
-- Additive only: it upgrades the migrated SQLite parity schema in place, so the
-- 16 users, 9 registrations, 15 announcements, 1 event and 0 projects keep
-- their IDs, hashes and timestamps. Nothing is dropped and no column is
-- renamed.
--
-- Applied once, inside a transaction, by server/db/migrations.js and recorded in
-- schema_migrations as '002_platform'. Every statement is written to be
-- re-runnable, because a partially applied migration must be recoverable.
--
-- Conventions
--   * Money is integer minor units (paise) + currency. Never floats.
--   * `events.name` is the event title (the legacy column name is kept so the
--     existing announcement and project joins keep working).
--   * Registrations are cancelled, never deleted. Events are archived, never
--     deleted. Participation history outlives archival by design.

-- ------------------------------------------------------------------ identity

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- Case-insensitive email uniqueness (the parity schema used a plain UNIQUE).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- Organizer authorization is a grant, not a shared passcode.
CREATE TABLE IF NOT EXISTS organizer_grants (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- Second factor for organizer sessions: a personal code, stored only as a hash.
CREATE TABLE IF NOT EXISTS organizer_access_codes (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------- events

ALTER TABLE events ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type        TEXT NOT NULL DEFAULT 'other';
ALTER TABLE events ADD COLUMN IF NOT EXISTS lifecycle         TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue             TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS starts_at         TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at           TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_name    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_email   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_asset_id    BIGINT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hero_asset_id     BIGINT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by        BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at       TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_type_check
    CHECK (event_type IN ('hackathon', 'debate', 'seminar', 'workshop',
                          'competition', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_lifecycle_check
    CHECK (lifecycle IN ('draft', 'upcoming', 'registration_open',
                         'registration_closed', 'ongoing', 'completed', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_window_check
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS events_public_idx
  ON events (lifecycle, starts_at NULLS LAST) WHERE is_published;
CREATE INDEX IF NOT EXISTS events_type_idx ON events (event_type);

-- 1:1 registration configuration. Never hardcoded in the frontend.
CREATE TABLE IF NOT EXISTS event_registration_settings (
  event_id             BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  opens_at             TIMESTAMPTZ,
  closes_at            TIMESTAMPTZ,
  is_paid              BOOLEAN NOT NULL DEFAULT FALSE,
  fee_minor            INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  currency             TEXT NOT NULL DEFAULT 'INR',
  capacity             INTEGER CHECK (capacity IS NULL OR capacity > 0), -- NULL = unlimited
  inventory_unit       TEXT NOT NULL DEFAULT 'participant'
                       CHECK (inventory_unit IN ('participant')),
  registration_mode    TEXT NOT NULL DEFAULT 'individual'
                       CHECK (registration_mode IN ('individual', 'team', 'both')),
  min_team_size        INTEGER NOT NULL DEFAULT 1 CHECK (min_team_size >= 1),
  max_team_size        INTEGER NOT NULL DEFAULT 1,
  pending_hold_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (pending_hold_minutes > 0),
  payment_instructions TEXT,
  payment_qr_asset_id  BIGINT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_team_size >= min_team_size)
);

-- -------------------------------------------------- configurable event content

CREATE TABLE IF NOT EXISTS event_domains (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_domains_event_idx ON event_domains (event_id, sort_order);

CREATE TABLE IF NOT EXISTS event_topics (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_topics_event_idx ON event_topics (event_id, sort_order);

-- Free-form rule blocks so a debate and a hackathon share one component.
CREATE TABLE IF NOT EXISTS event_rules (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section     TEXT NOT NULL DEFAULT 'rules',
  title       TEXT NOT NULL,
  body        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_rules_event_idx ON event_rules (event_id, section, sort_order);

CREATE TABLE IF NOT EXISTS speakers (
  id             BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  title          TEXT,
  organization   TEXT,
  bio            TEXT,
  profile_url    TEXT,
  photo_asset_id BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_speakers (
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  speaker_id BIGINT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, speaker_id)
);

CREATE TABLE IF NOT EXISTS event_sessions (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  speaker_id  BIGINT REFERENCES speakers(id) ON DELETE SET NULL,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  venue       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_sessions_event_idx ON event_sessions (event_id, sort_order);

CREATE TABLE IF NOT EXISTS event_criteria (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  weight      INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_faqs (
  id           BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

-- Organizer-defined extra fields collected at registration.
CREATE TABLE IF NOT EXISTS event_registration_fields (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  field_key   TEXT NOT NULL,
  label       TEXT NOT NULL,
  field_type  TEXT NOT NULL DEFAULT 'text'
              CHECK (field_type IN ('text', 'textarea', 'select', 'number', 'email', 'phone')),
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, field_key)
);

-- ------------------------------------------------- participants and registration

-- A participant is a person, not an account. A captain creates these rows for
-- teammates who have no login; the row is linked when that email is verified.
CREATE TABLE IF NOT EXISTS participants (
  id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  campus     TEXT,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_key ON participants (lower(email));
CREATE INDEX IF NOT EXISTS participants_user_idx ON participants (user_id);

CREATE TABLE IF NOT EXISTS teams (
  id                     BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id               BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  captain_participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_event_name_key ON teams (event_id, lower(name));

CREATE TABLE IF NOT EXISTS payments (
  id               BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id         BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id          BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  amount_minor     INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency         TEXT NOT NULL DEFAULT 'INR',
  method           TEXT NOT NULL DEFAULT 'upi_qr'
                   CHECK (method IN ('upi_qr', 'upi_intent', 'gateway', 'cash', 'free')),
  transaction_ref  TEXT,
  proof_asset_id   BIGINT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'submitted', 'verified', 'rejected', 'refunded')),
  submitted_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at     TIMESTAMPTZ,
  verified_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  refunded_at      TIMESTAMPTZ,
  refund_ref       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (event_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_ref_key
  ON payments (event_id, lower(transaction_ref))
  WHERE transaction_ref IS NOT NULL;

-- The legacy registrations table is upgraded in place rather than replaced, so
-- the nine migrated C³ signups keep their IDs.
--   user_id stays NULL for teammates the captain registered without an account.
ALTER TABLE registrations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS participant_id  BIGINT REFERENCES participants(id) ON DELETE RESTRICT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_id         BIGINT REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_id      BIGINT REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_captain      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reference       TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS custom_fields   JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS seats           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS confirmed_at    TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS cancelled_at    TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE registrations ADD CONSTRAINT registrations_status_check
    CHECK (status IN ('registered', 'pending_payment', 'payment_submitted',
                      'verification_pending', 'confirmed', 'cancelled',
                      'rejected', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE registrations ADD CONSTRAINT registrations_seats_check CHECK (seats >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every row needs a public reference; legacy rows derive theirs from the id.
UPDATE registrations SET reference = 'C3-REG-' || lpad(id::text, 4, '0')
 WHERE reference IS NULL;
UPDATE registrations SET seats = 1 WHERE seats IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_reference_key ON registrations (reference);
CREATE INDEX IF NOT EXISTS registrations_event_status_idx
  ON registrations (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS registrations_participant_idx ON registrations (participant_id);
CREATE INDEX IF NOT EXISTS registrations_team_idx ON registrations (team_id);

-- Seats that count against capacity. Pending holds expire; confirmed never do.
CREATE OR REPLACE VIEW registration_seat_usage AS
  SELECT event_id,
         COUNT(*) FILTER (
           WHERE status IN ('pending_payment', 'payment_submitted', 'verification_pending')
             AND (hold_expires_at IS NULL OR hold_expires_at > now())
         ) AS held_seats,
         COUNT(*) FILTER (WHERE status IN ('confirmed', 'registered')) AS confirmed_seats
  FROM registrations
  GROUP BY event_id;

CREATE TABLE IF NOT EXISTS passes (
  id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  registration_id BIGINT NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,   -- sha256 of the derived token
  token_prefix    TEXT NOT NULL,          -- short non-secret prefix for support
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS passes_event_idx ON passes (event_id);

CREATE TABLE IF NOT EXISTS check_ins (
  id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pass_id       BIGINT NOT NULL REFERENCES passes(id) ON DELETE CASCADE,
  event_id      BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  method        TEXT NOT NULL DEFAULT 'qr' CHECK (method IN ('qr', 'manual')),
  checked_in_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at   TIMESTAMPTZ,
  reverted_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  revert_reason TEXT
);
-- A pass can be checked in once; a reverted check-in no longer blocks entry.
CREATE UNIQUE INDEX IF NOT EXISTS check_ins_active_pass_key
  ON check_ins (pass_id) WHERE reverted_at IS NULL;
CREATE INDEX IF NOT EXISTS check_ins_event_idx ON check_ins (event_id, checked_in_at DESC);

-- --------------------------------------------------------------- certificates

CREATE TABLE IF NOT EXISTS certificate_templates (
  id         BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id   BIGINT REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'participation'
             CHECK (kind IN ('participation', 'rank', 'special')),
  -- Layout is data, not code: heading, signatories, colours, seal, body copy.
  layout     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id                BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id          BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id   BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  template_id       BIGINT REFERENCES certificate_templates(id) ON DELETE SET NULL,
  certificate_no    TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  kind              TEXT NOT NULL DEFAULT 'participation'
                    CHECK (kind IN ('participation', 'rank', 'special')),
  title             TEXT NOT NULL,
  rank_position     INTEGER,
  issued_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  revoked_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
  revoke_reason     TEXT,
  UNIQUE (event_id, registration_id, kind, title)
);
CREATE INDEX IF NOT EXISTS certificates_registration_idx ON certificates (registration_id);

CREATE TABLE IF NOT EXISTS event_rankings (
  id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id         BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  registration_id BIGINT REFERENCES registrations(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL CHECK (position > 0),
  score           NUMERIC(8, 2),
  published_at    TIMESTAMPTZ,
  UNIQUE (event_id, position)
);

-- --------------------------------------------------------------------- media

CREATE TABLE IF NOT EXISTS media_assets (
  id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_id      BIGINT REFERENCES events(id) ON DELETE SET NULL,
  storage_key   TEXT NOT NULL UNIQUE,
  url           TEXT NOT NULL,
  thumbnail_url TEXT,
  mime_type     TEXT NOT NULL,
  byte_size     INTEGER NOT NULL CHECK (byte_size > 0),
  width         INTEGER,
  height        INTEGER,
  alt_text      TEXT,
  caption       TEXT,
  credit        TEXT,
  placement     TEXT NOT NULL DEFAULT 'glimpse'
                CHECK (placement IN ('glimpse', 'hero', 'intro', 'speaker',
                                     'description', 'transition', 'payment_qr')),
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  uploaded_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_assets_event_idx
  ON media_assets (event_id, placement, sort_order);

-- ------------------------------------------------------------------- auditing

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_id      BIGINT REFERENCES events(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_event_idx ON audit_logs (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);

-- Forward references, declared after media_assets exists.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_cover_asset_fk;
ALTER TABLE events ADD CONSTRAINT events_cover_asset_fk
  FOREIGN KEY (cover_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_hero_asset_fk;
ALTER TABLE events ADD CONSTRAINT events_hero_asset_fk
  FOREIGN KEY (hero_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE event_registration_settings DROP CONSTRAINT IF EXISTS event_registration_payment_qr_fk;
ALTER TABLE event_registration_settings ADD CONSTRAINT event_registration_payment_qr_fk
  FOREIGN KEY (payment_qr_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE speakers DROP CONSTRAINT IF EXISTS speakers_photo_fk;
ALTER TABLE speakers ADD CONSTRAINT speakers_photo_fk
  FOREIGN KEY (photo_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
