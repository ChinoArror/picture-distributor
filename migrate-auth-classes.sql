CREATE TABLE IF NOT EXISTS photo_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

ALTER TABLE photos ADD COLUMN class_id TEXT;

CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_class_id ON photos(class_id);
CREATE INDEX IF NOT EXISTS idx_photos_vector_id ON photos(vector_id);
CREATE INDEX IF NOT EXISTS idx_photo_classes_is_open ON photo_classes(is_open);
CREATE INDEX IF NOT EXISTS idx_app_users_auth_uuid ON app_users(auth_uuid);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
