-- New uploads use a SHA-256 content identity. Existing photos are intentionally
-- left unlinked so their names and R2 object locations never change.
CREATE TABLE photo_assets (
  id TEXT PRIMARY KEY,
  hash_algorithm TEXT NOT NULL DEFAULT 'sha256' CHECK (hash_algorithm = 'sha256'),
  physical_owner_user_id TEXT NOT NULL,
  original_key TEXT NOT NULL UNIQUE,
  preview_key TEXT NOT NULL DEFAULT '',
  thumbnail_key TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL,
  original_bytes INTEGER NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  preview_bytes INTEGER NOT NULL DEFAULT 0 CHECK (preview_bytes >= 0),
  thumbnail_bytes INTEGER NOT NULL DEFAULT 0 CHECK (thumbnail_bytes >= 0),
  total_bytes INTEGER NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  object_status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (object_status IN ('uploading', 'ready', 'error')),
  image_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (image_status IN ('queued', 'processing', 'completed', 'decline', 'error')),
  facial_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (facial_status IN ('queued', 'processing', 'completed', 'error')),
  image_error_message TEXT NOT NULL DEFAULT '',
  facial_error_message TEXT NOT NULL DEFAULT '',
  vector_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (physical_owner_user_id) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_photo_assets_owner
  ON photo_assets(physical_owner_user_id, created_at);
CREATE INDEX idx_photo_assets_object_status
  ON photo_assets(object_status, updated_at);

ALTER TABLE photos ADD COLUMN asset_id TEXT
  REFERENCES photo_assets(id) ON DELETE SET NULL;
CREATE INDEX idx_photos_asset_id
  ON photos(asset_id, deleted_at, created_at);

ALTER TABLE photo_upload_records ADD COLUMN asset_id TEXT
  REFERENCES photo_assets(id) ON DELETE SET NULL;
ALTER TABLE photo_upload_records ADD COLUMN occupied_bytes INTEGER NOT NULL DEFAULT 0
  CHECK (occupied_bytes >= 0);
ALTER TABLE photo_upload_records ADD COLUMN is_deduplicated INTEGER NOT NULL DEFAULT 0
  CHECK (is_deduplicated IN (0, 1));
ALTER TABLE photo_upload_records ADD COLUMN facial_status TEXT NOT NULL DEFAULT 'queued'
  CHECK (facial_status IN ('queued', 'processing', 'completed', 'error'));
ALTER TABLE photo_upload_records ADD COLUMN facial_error_message TEXT NOT NULL DEFAULT '';

-- Historical records were charged by the legacy photo row and remain so.
UPDATE photo_upload_records SET occupied_bytes=total_bytes WHERE asset_id IS NULL;

CREATE INDEX idx_photo_upload_records_asset
  ON photo_upload_records(asset_id, uploaded_at, id);
