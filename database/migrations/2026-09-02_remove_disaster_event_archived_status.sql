-- Disaster events use CLOSED as their only normal ended status.
-- Convert legacy ARCHIVED rows before tightening the status constraint.
BEGIN;

UPDATE public.disaster_events
SET status = 'CLOSED'
WHERE status = 'ARCHIVED';

-- The original schema created this as an inline CHECK constraint. Resolve the
-- actual constraint name so this remains safe if a database renamed it.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'disaster_events'
      AND con.contype = 'c'
      AND (
        con.conname = 'disaster_events_status_check'
        OR pg_get_constraintdef(con.oid) ILIKE '%ARCHIVED%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.disaster_events DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE public.disaster_events
  ADD CONSTRAINT disaster_events_status_check
  CHECK (status IN ('PLANNED', 'ACTIVE', 'CLOSED'));

COMMIT;
