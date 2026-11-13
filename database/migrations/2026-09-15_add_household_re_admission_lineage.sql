BEGIN;

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS source_household_id uuid;

-- Recover lineage for re-admissions that were already audited before this
-- column existed. Do not infer links from names: unrelated people can share
-- the same name, and only an explicit re-admission audit record is authoritative.
WITH candidate_links AS (
  SELECT
    al.entity_id AS successor_household_id,
    CASE
      WHEN COALESCE(
        al.new_values_json ->> 'source_household_id',
        al.old_values_json ->> 'source_household_id'
      ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN COALESCE(
        al.new_values_json ->> 'source_household_id',
        al.old_values_json ->> 'source_household_id'
      )::uuid
      ELSE NULL
    END AS source_household_id,
    al.created_at
  FROM public.audit_logs al
  WHERE al.entity_type = 'HOUSEHOLD'
    AND al.action IN ('HOUSEHOLD_RE_ADMITTED', 'HOUSEHOLD_RETURN_TO_EVAC_CENTER')
    AND al.entity_id IS NOT NULL
),
valid_links AS (
  SELECT DISTINCT ON (candidate.successor_household_id)
    candidate.successor_household_id,
    candidate.source_household_id
  FROM candidate_links candidate
  INNER JOIN public.households successor
    ON successor.id = candidate.successor_household_id
  INNER JOIN public.households source
    ON source.id = candidate.source_household_id
  WHERE candidate.source_household_id IS NOT NULL
    AND candidate.successor_household_id <> candidate.source_household_id
    AND successor.source_household_id IS NULL
    AND successor.disaster_event_id = source.disaster_event_id
    AND successor.barangay_id = source.barangay_id
  ORDER BY candidate.successor_household_id, candidate.created_at DESC
)
UPDATE public.households successor
SET source_household_id = lineage_link.source_household_id
FROM valid_links lineage_link
WHERE successor.id = lineage_link.successor_household_id
  AND successor.source_household_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE connamespace = 'public'::pg_catalog.regnamespace
      AND conrelid = 'public.households'::pg_catalog.regclass
      AND conname = 'fk_households_source_household'
  ) THEN
    ALTER TABLE public.households
      ADD CONSTRAINT fk_households_source_household
      FOREIGN KEY (source_household_id)
      REFERENCES public.households(id)
      ON UPDATE NO ACTION
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE connamespace = 'public'::pg_catalog.regnamespace
      AND conrelid = 'public.households'::pg_catalog.regclass
      AND conname = 'chk_households_source_household_not_self'
  ) THEN
    ALTER TABLE public.households
      ADD CONSTRAINT chk_households_source_household_not_self
      CHECK (source_household_id IS NULL OR source_household_id <> id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_households_source_household_id
  ON public.households(source_household_id)
  WHERE source_household_id IS NOT NULL;

COMMIT;
