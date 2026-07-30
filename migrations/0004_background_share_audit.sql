ALTER TABLE user_backgrounds
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'custom'
  CHECK (mode IN ('none','custom','bing'));

ALTER TABLE share_links
  ADD COLUMN password_ciphertext TEXT;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  auth_uuid TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  sensitive INTEGER NOT NULL DEFAULT 0 CHECK (sensitive IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_time
  ON audit_logs(created_at DESC);
