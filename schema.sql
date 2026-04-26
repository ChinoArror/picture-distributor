PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  class_id TEXT,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'indexing', 'indexed', 'failed')),
  vector_id TEXT UNIQUE,
  vector_dimension_count INTEGER,
  indexed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_class_id ON photos(class_id);
CREATE INDEX IF NOT EXISTS idx_photos_vector_id ON photos(vector_id);

CREATE TABLE IF NOT EXISTS photo_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photo_classes_is_open ON photo_classes(is_open);

CREATE TABLE IF NOT EXISTS search_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  selfie_key TEXT NOT NULL,
  selfie_name TEXT,
  selfie_content_type TEXT,
  selfie_size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  query_vector_dimension_count INTEGER,
  match_count INTEGER NOT NULL DEFAULT 0,
  matched_photo_ids TEXT NOT NULL DEFAULT '[]',
  matched_urls TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_search_tasks_status ON search_tasks(status);
CREATE INDEX IF NOT EXISTS idx_search_tasks_created_at ON search_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_tasks_user_id_created_at ON search_tasks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('admin', 'auth', 'temp')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  auth_uuid TEXT UNIQUE,
  auth_user_id INTEGER,
  name TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  token TEXT,
  bound_temp_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_users_auth_uuid ON app_users(auth_uuid);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
