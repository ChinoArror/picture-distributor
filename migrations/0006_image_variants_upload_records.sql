CREATE TABLE image_processing_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

INSERT INTO image_processing_settings (id, enabled) VALUES (1, 1);

CREATE TABLE photo_upload_records (
  id TEXT PRIMARY KEY,
  photo_id TEXT UNIQUE,
  uploader_user_id TEXT,
  uploader_auth_uuid TEXT NOT NULL DEFAULT '',
  uploader_name TEXT NOT NULL DEFAULT '',
  class_id TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL,
  stored_original_name TEXT NOT NULL,
  content_id TEXT NOT NULL DEFAULT '',
  original_key TEXT NOT NULL,
  preview_key TEXT NOT NULL DEFAULT '',
  thumbnail_key TEXT NOT NULL DEFAULT '',
  original_bytes INTEGER NOT NULL DEFAULT 0 CHECK (original_bytes >= 0),
  preview_bytes INTEGER NOT NULL DEFAULT 0 CHECK (preview_bytes >= 0),
  thumbnail_bytes INTEGER NOT NULL DEFAULT 0 CHECK (thumbnail_bytes >= 0),
  total_bytes INTEGER NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  queue_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (queue_status IN ('queued', 'processing', 'completed', 'decline', 'error')),
  error_message TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_started_at TEXT,
  processed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE SET NULL,
  FOREIGN KEY (uploader_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_photo_upload_records_user_time
  ON photo_upload_records(uploader_user_id, uploaded_at DESC, id DESC);
CREATE INDEX idx_photo_upload_records_status_time
  ON photo_upload_records(queue_status, uploaded_at DESC);
CREATE INDEX idx_photo_upload_records_content
  ON photo_upload_records(content_id, class_id);

-- Historical objects retain their existing keys. They are recorded as
-- declined so no unmetered Images transformation is implied.
INSERT INTO photo_upload_records (
  id,
  photo_id,
  uploader_user_id,
  uploader_auth_uuid,
  uploader_name,
  class_id,
  class_name,
  original_filename,
  stored_original_name,
  original_key,
  original_bytes,
  total_bytes,
  queue_status,
  uploaded_at,
  updated_at
)
SELECT
  'up_' || p.id,
  p.id,
  p.owner_user_id,
  COALESCE(u.auth_uuid, ''),
  COALESCE(NULLIF(u.username, ''), NULLIF(u.name, ''), 'Unknown user'),
  p.class_id,
  COALESCE(c.name, ''),
  p.original_name,
  p.r2_key,
  p.r2_key,
  COALESCE(p.byte_size, p.size_bytes, 0),
  COALESCE(p.byte_size, p.size_bytes, 0),
  'decline',
  p.created_at,
  CURRENT_TIMESTAMP
FROM photos p
LEFT JOIN app_users u ON u.id = p.owner_user_id
LEFT JOIN photo_classes c ON c.id = p.class_id
ON CONFLICT(photo_id) DO NOTHING;
