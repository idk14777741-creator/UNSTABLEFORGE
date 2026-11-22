-- Media bytes stored beside their media_assets row.
--
-- The uploader writes files to MEDIA_DIR, but free hosting tiers have no
-- persistent disk: that directory is wiped on every deploy and every idle
-- spin-down. Keeping the bytes here means an uploaded banner still resolves at
-- /media/<key> after a restart. Rows are keyed by storage_key, the same value
-- media_assets uses, so deleting an asset deletes its bytes.

CREATE TABLE IF NOT EXISTS media_blobs (
  storage_key TEXT PRIMARY KEY,
  mime_type   TEXT NOT NULL,
  byte_size   INTEGER NOT NULL CHECK (byte_size > 0),
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
