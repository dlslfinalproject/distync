BEGIN;

UPDATE sync_conflicts
SET resolution_strategy = 'MANUAL_REVIEW'
WHERE resolution_strategy = 'MANUAL_REVIEW_REQUIRED';

UPDATE sync_conflicts
SET resolution_strategy = 'FIRST_ACCEPTED'
WHERE resolution_strategy = 'EARLIEST_TIMESTAMP';

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t
      ON t.oid = c.conrelid
    INNER JOIN pg_namespace n
      ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'sync_conflicts'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%resolution_strategy%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.sync_conflicts DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.sync_conflicts
ADD CONSTRAINT sync_conflicts_resolution_strategy_check
CHECK (
  resolution_strategy::text = ANY (
    ARRAY[
      'FIRST_ACCEPTED'::character varying,
      'LATEST_TIMESTAMP'::character varying,
      'MANUAL_REVIEW'::character varying,
      'MERGED'::character varying
    ]::text[]
  )
);

COMMIT;
