BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.relief_pack_templates
    GROUP BY LOWER(BTRIM(name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce relief pack template name uniqueness while duplicate names exist. Resolve duplicate names before applying this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS relief_pack_templates_name_normalized_unique
ON public.relief_pack_templates (LOWER(BTRIM(name)));

COMMIT;
