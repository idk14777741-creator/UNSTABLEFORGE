-- UNSTABLE FORGE — SQLite schema (local development fallback).
-- Mirrors server/db/schema.postgres.sql so the same application SQL runs on both.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  tagline    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'participant',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email            TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts (email);

CREATE TABLE IF NOT EXISTS announcements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  content      TEXT NOT NULL,
  category     TEXT NOT NULL,
  published_at TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_announcements_public
  ON announcements (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_event
  ON announcements (event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_category
  ON announcements (category);

CREATE TABLE IF NOT EXISTS registrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  full_name  TEXT NOT NULL,
  campus     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, event_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_registrations_event
  ON registrations (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id        INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  tagline         TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  technologies    TEXT NOT NULL DEFAULT '[]',
  team_name       TEXT,
  repo_url        TEXT,
  demo_url        TEXT,
  cover_image_url TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'published', 'rejected')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_at    TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_public
  ON projects (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_event
  ON projects (event_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner
  ON projects (user_id);
