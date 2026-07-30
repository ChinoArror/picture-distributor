ALTER TABLE photo_classes ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE TABLE user_backgrounds (
  user_id TEXT PRIMARY KEY,
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

CREATE INDEX idx_user_backgrounds_restore
  ON user_backgrounds(restore_deadline);
