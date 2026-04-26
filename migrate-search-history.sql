ALTER TABLE search_tasks ADD COLUMN user_id TEXT;
ALTER TABLE search_tasks ADD COLUMN selfie_name TEXT;
ALTER TABLE search_tasks ADD COLUMN selfie_content_type TEXT;
ALTER TABLE search_tasks ADD COLUMN selfie_size_bytes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_search_tasks_user_id_created_at ON search_tasks(user_id, created_at DESC);
