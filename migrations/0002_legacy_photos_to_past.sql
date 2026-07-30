-- Metadata-only legacy backfill. This does not copy or delete R2 objects.
-- Apply only after the remote preflight and backup documented in README.

INSERT INTO app_users (
  id, kind, role, role_id, name, username, created_at, updated_at, last_seen_at
)
SELECT
  'user_legacy_admin',
  'admin',
  'admin',
  'role_admin',
  'Legacy administrator',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE role = 'admin');

INSERT INTO photo_classes (
  id, name, is_open, created_by, owner_user_id, visibility, created_at, updated_at
)
SELECT
  'c_past000000000000',
  'past',
  0,
  admin.id,
  admin.id,
  'private',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT id
  FROM app_users
  WHERE role = 'admin'
  ORDER BY created_at, id
  LIMIT 1
) AS admin
WHERE NOT EXISTS (
  SELECT 1 FROM photo_classes WHERE id = 'c_past000000000000'
);

-- New-model uploads always have an owner. Null therefore identifies legacy
-- rows safely even if this migration is applied after the new Worker deploys.
UPDATE photos
SET class_id = 'c_past000000000000'
WHERE owner_user_id IS NULL;

UPDATE photos
SET owner_user_id = (
  SELECT owner_user_id
  FROM photo_classes
  WHERE id = 'c_past000000000000'
)
WHERE owner_user_id IS NULL;

-- All ownerless rows are legacy rows. Preserve their empty class records for
-- audit, but hide them so old open classes do not appear as empty search hits.
UPDATE photo_classes
SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
    visibility = 'private',
    is_open = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE id <> 'c_past000000000000'
  AND owner_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM photos
    WHERE photos.class_id = photo_classes.id
      AND photos.deleted_at IS NULL
  );

UPDATE photo_classes
SET owner_user_id = (
  SELECT owner_user_id
  FROM photo_classes
  WHERE id = 'c_past000000000000'
)
WHERE owner_user_id IS NULL;

UPDATE app_users
SET storage_used_bytes = COALESCE((
  SELECT SUM(COALESCE(p.byte_size, p.size_bytes, 0))
  FROM photos AS p
  WHERE p.owner_user_id = app_users.id
    AND p.deleted_at IS NULL
), 0),
    updated_at = CURRENT_TIMESTAMP;
