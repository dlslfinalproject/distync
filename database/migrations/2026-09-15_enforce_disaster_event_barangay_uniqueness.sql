BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.disaster_event_barangays
    GROUP BY disaster_event_id, barangay_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot enforce disaster event barangay uniqueness while duplicate mappings exist. Resolve duplicate mappings before applying this migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE connamespace = 'public'::pg_catalog.regnamespace
      AND conrelid = 'public.disaster_event_barangays'::pg_catalog.regclass
      AND conname = 'uq_disaster_event_barangay'
  ) THEN
    ALTER TABLE public.disaster_event_barangays
      ADD CONSTRAINT uq_disaster_event_barangay
      UNIQUE (disaster_event_id, barangay_id);
  END IF;
END
$$;

COMMIT;
