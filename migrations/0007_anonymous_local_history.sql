-- Anonymous sessions are operational identities for queued selfie searches only.
-- They do not receive roles or appear in role/user administration.

DROP TRIGGER IF EXISTS trg_app_users_assign_default_role;

UPDATE app_users SET role_id = NULL WHERE kind = 'temp';

CREATE TRIGGER trg_app_users_assign_default_role
AFTER INSERT ON app_users
FOR EACH ROW
WHEN NEW.role_id IS NULL AND NEW.kind != 'temp'
BEGIN
  UPDATE app_users
  SET role_id = CASE
    WHEN NEW.role = 'admin' THEN 'role_admin'
    ELSE (SELECT id FROM roles WHERE is_default = 1 LIMIT 1)
  END
  WHERE id = NEW.id;
END;
