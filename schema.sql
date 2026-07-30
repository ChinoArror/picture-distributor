PRAGMA foreign_keys = ON;

-- Fresh-install schema. Legacy columns remain until all deployed Workers stop
-- reading them; see migrations/ for the additive production upgrade.

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  access_mode TEXT NOT NULL CHECK (access_mode IN ('all_read', 'all_write', 'own_write', 'own_read')),
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

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('admin', 'auth', 'temp')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')), -- legacy compatibility
  role_id TEXT NOT NULL DEFAULT 'role_default',
  storage_used_bytes INTEGER NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
  auth_uuid TEXT UNIQUE,
  auth_user_id INTEGER,
  name TEXT NOT NULL,
  username TEXT,
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  token TEXT, -- legacy compatibility; new code must not persist Auth Center tokens
  bound_temp_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_app_users_auth_uuid ON app_users(auth_uuid);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_role_id ON app_users(role_id);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);

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

CREATE TABLE IF NOT EXISTS photo_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_open INTEGER NOT NULL DEFAULT 0 CHECK (is_open IN (0, 1)), -- legacy compatibility
  created_by TEXT, -- legacy compatibility
  owner_user_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  deleted_at TEXT,
  delete_job_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (delete_job_id) REFERENCES deletion_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_photo_classes_is_open ON photo_classes(is_open);
CREATE INDEX IF NOT EXISTS idx_photo_classes_owner ON photo_classes(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_classes_visibility_name
  ON photo_classes(visibility, deleted_at, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0), -- legacy compatibility
  byte_size INTEGER NOT NULL DEFAULT 0 CHECK (byte_size >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'indexing', 'indexed', 'failed')),
  vector_id TEXT UNIQUE, -- Alibaba Facebody EntityId; retained for compatibility
  vector_dimension_count INTEGER,
  indexed_at TEXT,
  error_message TEXT,
  class_removed_at TEXT,
  deleted_at TEXT,
  delete_job_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES photo_classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (delete_job_id) REFERENCES deletion_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_class_id
  ON photos(class_id, class_removed_at, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_owner ON photos(owner_user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_vector_id ON photos(vector_id);

CREATE TABLE IF NOT EXISTS image_processing_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

INSERT INTO image_processing_settings (id, enabled)
VALUES (1, 1)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS photo_upload_records (
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

CREATE INDEX IF NOT EXISTS idx_photo_upload_records_user_time
  ON photo_upload_records(uploader_user_id, uploaded_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_photo_upload_records_status_time
  ON photo_upload_records(queue_status, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_upload_records_content
  ON photo_upload_records(content_id, class_id);

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

CREATE TABLE IF NOT EXISTS user_backgrounds (
  user_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'custom' CHECK (mode IN ('none','custom','bing')),
  original_key TEXT,
  cropped_key TEXT,
  original_content_type TEXT NOT NULL DEFAULT '',
  cropped_content_type TEXT NOT NULL DEFAULT '',
  pending_original_key TEXT,
  pending_cropped_key TEXT,
  restore_token_hash TEXT,
  restore_deadline TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_backgrounds_restore
  ON user_backgrounds(restore_deadline);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(slug) BETWEEN 3 AND 64),
  starts_at TEXT,
  ends_at TEXT,
  password_salt TEXT,
  password_hash TEXT,
  password_ciphertext TEXT,
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  auth_uuid TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  sensitive INTEGER NOT NULL DEFAULT 0 CHECK (sensitive IN (0,1)),
  target_kind TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  target_name TEXT NOT NULL DEFAULT '',
  target_count INTEGER NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time
  ON audit_logs(created_at DESC);

-- A class row means "all current photos in this class"; photo rows select
-- individual photos. Public rendering uses their union and rechecks soft deletes.
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

-- Only a one-way hash of the browser's share-session token is stored.
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

CREATE TABLE IF NOT EXISTS search_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  selfie_key TEXT NOT NULL,
  selfie_name TEXT,
  selfie_content_type TEXT,
  selfie_size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (selfie_size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  query_vector_dimension_count INTEGER, -- legacy compatibility
  match_count INTEGER NOT NULL DEFAULT 0 CHECK (match_count >= 0),
  matched_photo_ids TEXT NOT NULL DEFAULT '[]',
  matched_scores TEXT NOT NULL DEFAULT '[]',
  matched_urls TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_search_tasks_status ON search_tasks(status);
CREATE INDEX IF NOT EXISTS idx_search_tasks_created_at ON search_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_tasks_user_id_created_at
  ON search_tasks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS class_search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  matched_photo_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_class_search_history_user_created
  ON class_search_history(user_id, created_at DESC);
