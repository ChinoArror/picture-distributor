-- Additive upgrade from the legacy schema. Wrangler records this migration, so
-- it must be applied once after inspecting the remote schema (see README).

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  access_mode TEXT NOT NULL CHECK (access_mode IN ('all_read', 'all_write', 'own_write')),
  quota_bytes INTEGER NOT NULL DEFAULT 0 CHECK (quota_bytes >= 0),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_one_default
  ON roles(is_default) WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order, name);

INSERT INTO roles (
  id, name, description, access_mode, quota_bytes, is_default, is_system, sort_order
) VALUES
  ('role_default', 'Default viewer', 'Read-only access to all classes.', 'all_read', 5000000000, 1, 1, 10),
  ('role_admin', 'Administrators', 'System role for administrators.', 'all_write', 1000000000000, 0, 1, 0)
ON CONFLICT(id) DO NOTHING;

ALTER TABLE app_users ADD COLUMN role_id TEXT REFERENCES roles(id) ON DELETE RESTRICT;
ALTER TABLE app_users ADD COLUMN storage_used_bytes INTEGER NOT NULL DEFAULT 0
  CHECK (storage_used_bytes >= 0);

UPDATE app_users
SET role_id = CASE WHEN role = 'admin' THEN 'role_admin' ELSE 'role_default' END
WHERE role_id IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_app_users_assign_default_role
AFTER INSERT ON app_users
FOR EACH ROW
WHEN NEW.role_id IS NULL
BEGIN
  UPDATE app_users
  SET role_id = CASE
    WHEN NEW.role = 'admin' THEN 'role_admin'
    ELSE (SELECT id FROM roles WHERE is_default = 1 LIMIT 1)
  END
  WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_app_users_role_id ON app_users(role_id);

CREATE TABLE IF NOT EXISTS deletion_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'class', 'rekey_photo')),
  target_id TEXT NOT NULL,
  force INTEGER NOT NULL DEFAULT 0 CHECK (force IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_by_user_id TEXT,
  expected_owner_user_id TEXT,
  cursor TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (requested_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  FOREIGN KEY (expected_owner_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deletion_jobs_active_target
  ON deletion_jobs(kind, target_id)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_deletion_jobs_status_created
  ON deletion_jobs(status, created_at);

ALTER TABLE photo_classes ADD COLUMN owner_user_id TEXT
  REFERENCES app_users(id) ON DELETE RESTRICT;
ALTER TABLE photo_classes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));
ALTER TABLE photo_classes ADD COLUMN deleted_at TEXT;
ALTER TABLE photo_classes ADD COLUMN delete_job_id TEXT
  REFERENCES deletion_jobs(id) ON DELETE SET NULL;

UPDATE photo_classes
SET visibility = CASE WHEN is_open = 1 THEN 'public' ELSE 'private' END;

CREATE INDEX IF NOT EXISTS idx_photo_classes_owner
  ON photo_classes(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_classes_visibility_name
  ON photo_classes(visibility, deleted_at, name COLLATE NOCASE);

ALTER TABLE photos ADD COLUMN owner_user_id TEXT
  REFERENCES app_users(id) ON DELETE RESTRICT;
ALTER TABLE photos ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0
  CHECK (byte_size >= 0);
ALTER TABLE photos ADD COLUMN class_removed_at TEXT;
ALTER TABLE photos ADD COLUMN deleted_at TEXT;
ALTER TABLE photos ADD COLUMN delete_job_id TEXT
  REFERENCES deletion_jobs(id) ON DELETE SET NULL;

UPDATE photos SET byte_size = COALESCE(size_bytes, 0);

CREATE INDEX IF NOT EXISTS idx_photos_owner
  ON photos(owner_user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_class_deleted
  ON photos(class_id, class_removed_at, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_classes (
  user_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, class_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES photo_classes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_classes_transfer
  ON saved_classes(class_id, created_at, user_id);

CREATE TABLE IF NOT EXISTS saved_photos (
  user_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, photo_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_photos_transfer
  ON saved_photos(photo_id, created_at, user_id);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(slug) BETWEEN 3 AND 64),
  starts_at TEXT,
  ends_at TEXT,
  password_salt TEXT,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (
    (password_salt IS NULL AND password_hash IS NULL)
    OR (password_salt IS NOT NULL AND password_hash IS NOT NULL)
  ),
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_owner
  ON share_links(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_links_active_window
  ON share_links(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS share_link_classes (
  share_link_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  PRIMARY KEY (share_link_id, class_id),
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES photo_classes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_link_classes_class
  ON share_link_classes(class_id, share_link_id);

CREATE TABLE IF NOT EXISTS share_link_photos (
  share_link_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  PRIMARY KEY (share_link_id, photo_id),
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_link_photos_photo
  ON share_link_photos(photo_id, share_link_id);

CREATE TABLE IF NOT EXISTS share_sessions (
  token_hash TEXT PRIMARY KEY,
  share_link_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_sessions_link
  ON share_sessions(share_link_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_share_sessions_expires ON share_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires
  ON rate_limit_buckets(expires_at);

ALTER TABLE search_tasks ADD COLUMN matched_scores TEXT NOT NULL DEFAULT '[]';

-- Legacy Workers persisted bearer tokens. The new Worker verifies them once
-- and stores only stable identity claims plus its own opaque session id.
UPDATE app_users SET token = NULL WHERE token IS NOT NULL;
