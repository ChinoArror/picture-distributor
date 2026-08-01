-- Prevent concurrent byte-identical uploads from creating two active logical
-- photos in the same class. Historical photos have asset_id NULL and are not
-- included in this constraint.
CREATE UNIQUE INDEX idx_photos_class_asset_active
  ON photos(class_id, asset_id) WHERE asset_id IS NOT NULL AND deleted_at IS NULL;
