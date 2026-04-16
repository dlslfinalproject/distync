BEGIN;

ALTER TABLE evacuees
DROP CONSTRAINT IF EXISTS chk_evacuee_age_group;

ALTER TABLE evacuees
DROP COLUMN IF EXISTS age_group;

COMMIT;
