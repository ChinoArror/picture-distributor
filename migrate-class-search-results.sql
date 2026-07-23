ALTER TABLE class_search_history ADD COLUMN result_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE class_search_history ADD COLUMN matched_photo_ids TEXT NOT NULL DEFAULT '[]';
