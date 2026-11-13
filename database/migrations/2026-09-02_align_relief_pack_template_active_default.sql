-- New relief-pack templates must remain inactive until explicitly activated.

BEGIN;

ALTER TABLE public.relief_pack_templates
  ALTER COLUMN is_active SET DEFAULT false;

COMMIT;
