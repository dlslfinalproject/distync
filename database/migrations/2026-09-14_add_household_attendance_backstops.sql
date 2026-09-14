BEGIN;

SELECT pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('distync:stage3:household-attendance-backstops', 0)
);

LOCK TABLE
  public.households,
  public.evacuees,
  public.evacuation_logs,
  public.stubs
IN SHARE ROW EXCLUSIVE MODE;

-- Verify the lifecycle tables, columns, and the existing simple relationships
-- that define the approved action semantics for the new composite keys.
DO $$
DECLARE
  missing_relation text;
  missing_column text;
BEGIN
  SELECT required.table_name
  INTO missing_relation
  FROM (VALUES
    ('households'),
    ('evacuees'),
    ('evacuation_logs'),
    ('stubs')
  ) AS required(table_name)
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = 'public'::pg_catalog.regnamespace
   AND c.relname = required.table_name
  WHERE c.oid IS NULL OR c.relkind <> 'r'
  LIMIT 1;

  IF missing_relation IS NOT NULL THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — required public table is missing or is not an ordinary table: %', missing_relation;
  END IF;

  SELECT required.table_name || '.' || required.column_name
  INTO missing_column
  FROM (VALUES
    ('households', 'id'),
    ('households', 'disaster_event_id'),
    ('households', 'family_head_evacuee_id'),
    ('evacuees', 'id'),
    ('evacuees', 'household_id'),
    ('evacuees', 'is_family_head'),
    ('evacuation_logs', 'household_id'),
    ('evacuation_logs', 'disaster_event_id'),
    ('evacuation_logs', 'evacuee_id'),
    ('evacuation_logs', 'status'),
    ('evacuation_logs', 'time_in'),
    ('evacuation_logs', 'time_out'),
    ('stubs', 'household_id'),
    ('stubs', 'disaster_event_id')
  ) AS required(table_name, column_name)
  LEFT JOIN pg_catalog.pg_attribute a
    ON a.attrelid = (format('public.%I', required.table_name))::pg_catalog.regclass
   AND a.attname = required.column_name
   AND a.attnum > 0
   AND NOT a.attisdropped
  WHERE a.attnum IS NULL
  LIMIT 1;

  IF missing_column IS NOT NULL THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — required public column is missing: %', missing_column;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.conname = 'chk_evacuation_log_time'
      AND c.contype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND lower(
        pg_catalog.regexp_replace(
          pg_catalog.pg_get_constraintdef(c.oid, true),
          '[[:space:]]+',
          '',
          'g'
        )
      ) IN (
        'check((time_outisnull)or(time_out>=time_in))',
        'check(time_outisnullortime_out>=time_in)'
      )
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing chk_evacuation_log_time is missing or differs from the audited time-order backstop';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.contype = 'c'
      AND lower(pg_catalog.pg_get_constraintdef(c.oid, true)) LIKE '%present%'
      AND lower(pg_catalog.pg_get_constraintdef(c.oid, true)) LIKE '%left%'
      AND lower(pg_catalog.pg_get_constraintdef(c.oid, true)) LIKE '%transferred%'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing attendance status semantics do not include PRESENT, LEFT, and TRANSFERRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_evacuee'
      AND c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'family_head_evacuee_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'n'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing family-head pointer FK does not preserve MATCH SIMPLE, NO ACTION, and SET NULL behavior';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conname = 'evacuation_logs_household_id_fkey'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing attendance household FK does not preserve MATCH SIMPLE, NO ACTION, and CASCADE behavior';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conname = 'evacuation_logs_evacuee_id_fkey'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'evacuee_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing attendance evacuee FK does not preserve MATCH SIMPLE, NO ACTION, and CASCADE behavior';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conname = 'stubs_household_id_fkey'
      AND c.conrelid = 'public.stubs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — existing stub household FK does not preserve MATCH SIMPLE, NO ACTION, and CASCADE behavior';
  END IF;
END
$$;

-- Read-only compatibility gate. No business rows are changed by this migration.
DO $$
DECLARE
  c1_groups bigint;
  c1_rows bigint;
  c2_groups bigint;
  c2_rows bigint;
  c4_groups bigint;
  c4_rows bigint;
  c5_groups bigint;
  c5_rows bigint;
  c7_groups bigint;
  c7_rows bigint;
  c8_groups bigint;
  c8_rows bigint;
  c9_groups bigint;
  c9_rows bigint;
  evacuee_key_groups bigint;
  evacuee_key_rows bigint;
  household_key_groups bigint;
  household_key_rows bigint;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(group_count), 0)::bigint
  INTO c1_groups, c1_rows
  FROM (
    SELECT evacuee_id, COUNT(*)::bigint AS group_count
    FROM public.evacuation_logs
    WHERE status = 'PRESENT'
      AND time_out IS NULL
    GROUP BY evacuee_id
    HAVING COUNT(*) > 1
  ) AS duplicate_open_attendance;

  SELECT COUNT(DISTINCT status), COUNT(*)
  INTO c2_groups, c2_rows
  FROM public.evacuation_logs
  WHERE status NOT IN ('PRESENT', 'LEFT', 'TRANSFERRED')
     OR (status = 'PRESENT' AND time_out IS NOT NULL)
     OR (status IN ('LEFT', 'TRANSFERRED') AND time_out IS NULL);

  SELECT COUNT(*), COALESCE(SUM(group_count), 0)::bigint
  INTO c4_groups, c4_rows
  FROM (
    SELECT household_id, COUNT(*)::bigint AS group_count
    FROM public.evacuees
    WHERE is_family_head IS TRUE
    GROUP BY household_id
    HAVING COUNT(*) > 1
  ) AS duplicate_family_heads;

  SELECT COUNT(*), COUNT(*)
  INTO c5_groups, c5_rows
  FROM public.households h
  LEFT JOIN public.evacuees e
    ON e.id = h.family_head_evacuee_id
   AND e.household_id = h.id
  WHERE h.family_head_evacuee_id IS NOT NULL
    AND e.id IS NULL;

  SELECT COUNT(*), COUNT(*)
  INTO c7_groups, c7_rows
  FROM public.evacuation_logs l
  JOIN public.households h ON h.id = l.household_id
  WHERE l.disaster_event_id IS DISTINCT FROM h.disaster_event_id;

  SELECT COUNT(*), COUNT(*)
  INTO c8_groups, c8_rows
  FROM public.evacuation_logs l
  JOIN public.evacuees e ON e.id = l.evacuee_id
  WHERE l.household_id IS DISTINCT FROM e.household_id;

  SELECT COUNT(*), COUNT(*)
  INTO c9_groups, c9_rows
  FROM public.stubs s
  JOIN public.households h ON h.id = s.household_id
  WHERE s.disaster_event_id IS DISTINCT FROM h.disaster_event_id;

  SELECT COUNT(*), COALESCE(SUM(group_count), 0)::bigint
  INTO evacuee_key_groups, evacuee_key_rows
  FROM (
    SELECT id, household_id, COUNT(*)::bigint AS group_count
    FROM public.evacuees
    GROUP BY id, household_id
    HAVING COUNT(*) > 1
  ) AS duplicate_evacuee_keys;

  SELECT COUNT(*), COALESCE(SUM(group_count), 0)::bigint
  INTO household_key_groups, household_key_rows
  FROM (
    SELECT id, disaster_event_id, COUNT(*)::bigint AS group_count
    FROM public.households
    GROUP BY id, disaster_event_id
    HAVING COUNT(*) > 1
  ) AS duplicate_household_keys;

  IF c1_groups > 0 OR c1_rows > 0
     OR c2_groups > 0 OR c2_rows > 0
     OR c4_groups > 0 OR c4_rows > 0
     OR c5_groups > 0 OR c5_rows > 0
     OR c7_groups > 0 OR c7_rows > 0
     OR c8_groups > 0 OR c8_rows > 0
     OR c9_groups > 0 OR c9_rows > 0
     OR evacuee_key_groups > 0 OR evacuee_key_rows > 0
     OR household_key_groups > 0 OR household_key_rows > 0 THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — LIVE DATA REPAIR REVIEW REQUIRED';
  END IF;
END
$$;

-- Fail closed on same-name collisions and equivalent objects under another name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuation_logs_open_evacuee'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuation_logs_open_evacuee'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
          AND a.attname = 'evacuee_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'status=''present''andtime_outisnull'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_evacuation_logs_open_evacuee already exists with a different definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relkind = 'i'
      AND idx.relname <> 'uq_evacuation_logs_open_evacuee'
      AND i.indrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
          AND a.attname = 'evacuee_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'status=''present''andtime_outisnull'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved open-attendance index exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuees_household_family_head'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuees_household_family_head'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuees'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
          AND a.attname = 'household_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'is_family_headistrue'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_evacuees_household_family_head already exists with a different definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relkind = 'i'
      AND idx.relname <> 'uq_evacuees_household_family_head'
      AND i.indrelid = 'public.evacuees'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
          AND a.attname = 'household_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'is_family_headistrue'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved family-head index exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuation_logs_open_evacuee'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
          AND a.attname = 'evacuee_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'status=''present''andtime_outisnull'
  ) THEN
    EXECUTE $migration$CREATE UNIQUE INDEX uq_evacuation_logs_open_evacuee ON public.evacuation_logs (evacuee_id) WHERE status = 'PRESENT' AND time_out IS NULL$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuees_household_family_head'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuees'::pg_catalog.regclass
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indexprs IS NULL
      AND i.indpred IS NOT NULL
      AND i.indkey[0] = (
        SELECT a.attnum
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
          AND a.attname = 'household_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),
            '[[:space:]]+', '', 'g'
          ),
          '::(text|character varying|text\[\]|character varying\[\])', '', 'g'
        ),
        '[()]', '', 'g'
      ) = 'is_family_headistrue'
  ) THEN
    EXECUTE $migration$CREATE UNIQUE INDEX uq_evacuees_household_family_head ON public.evacuees (household_id) WHERE is_family_head IS TRUE$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_evacuees_id_household'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint c
      WHERE c.connamespace = 'public'::pg_catalog.regnamespace
        AND c.conname = 'uq_evacuees_id_household'
        AND c.conrelid = 'public.evacuees'::pg_catalog.regclass
        AND c.contype = 'u'
        AND c.conkey = ARRAY[
          (
            SELECT a.attnum
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
              AND a.attname = 'id'
              AND a.attnum > 0
              AND NOT a.attisdropped
          ),
          (
            SELECT a.attnum
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
              AND a.attname = 'household_id'
              AND a.attnum > 0
              AND NOT a.attisdropped
          )
        ]::smallint[]
        AND c.convalidated
        AND NOT c.condeferrable
        AND NOT c.condeferred
    ) THEN
      RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_evacuees_id_household already exists with a different definition';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuees_id_household'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_evacuees_id_household name is already used by another relation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'u'
      AND c.conname <> 'uq_evacuees_id_household'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved evacuee supporting key exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_households_id_event'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_constraint c
      WHERE c.connamespace = 'public'::pg_catalog.regnamespace
        AND c.conname = 'uq_households_id_event'
        AND c.conrelid = 'public.households'::pg_catalog.regclass
        AND c.contype = 'u'
        AND c.conkey = ARRAY[
          (
            SELECT a.attnum
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.households'::pg_catalog.regclass
              AND a.attname = 'id'
              AND a.attnum > 0
              AND NOT a.attisdropped
          ),
          (
            SELECT a.attnum
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = 'public.households'::pg_catalog.regclass
              AND a.attname = 'disaster_event_id'
              AND a.attnum > 0
              AND NOT a.attisdropped
          )
        ]::smallint[]
        AND c.convalidated
        AND NOT c.condeferrable
        AND NOT c.condeferred
    ) THEN
      RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_households_id_event already exists with a different definition';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_households_id_event'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — uq_households_id_event name is already used by another relation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'u'
      AND c.conname <> 'uq_households_id_event'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved household supporting key exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_status_time_out'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_status_time_out'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.contype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                lower(pg_catalog.pg_get_constraintdef(c.oid, true)),
                '::character varying\[\]', '', 'g'
              ),
              '::character varying', '', 'g'
            ),
            '::text\[\]', '', 'g'
          ),
          '::text', '', 'g'
        ),
        '[[:space:]]+', '', 'g'
      ) = 'check(status=''present''andtime_outisnullor(status=any(array[''left'',''transferred'']))andtime_outisnotnull)'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — chk_evacuation_log_status_time_out already exists with a different definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.contype = 'c'
      AND c.conname <> 'chk_evacuation_log_status_time_out'
      AND c.convalidated
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                lower(pg_catalog.pg_get_constraintdef(c.oid, true)),
                '::character varying\[\]', '', 'g'
              ),
              '::character varying', '', 'g'
            ),
            '::text\[\]', '', 'g'
          ),
          '::text', '', 'g'
        ),
        '[[:space:]]+', '', 'g'
      ) = 'check(status=''present''andtime_outisnullor(status=any(array[''left'',''transferred'']))andtime_outisnotnull)'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved attendance status/time_out check exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_same_household'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_same_household'
      AND c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'family_head_evacuee_id'
            AND a.attnum > 0 AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0 AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'n'
      AND pg_catalog.pg_get_constraintdef(c.oid, true) ILIKE '%ON DELETE SET NULL (family_head_evacuee_id)%'
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — fk_households_family_head_same_household already exists with a different definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conname <> 'fk_households_family_head_same_household'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'family_head_evacuee_id'
            AND a.attnum > 0 AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0 AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0 AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'n'
      AND pg_catalog.pg_get_constraintdef(c.oid, true) ILIKE '%ON DELETE SET NULL (family_head_evacuee_id)%'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved family-head membership FK exists under another name';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname IN (
        'fk_evacuation_logs_household_event',
        'fk_evacuation_logs_evacuee_household',
        'fk_stub_household_event'
      )
      AND NOT (
        (c.conname = 'fk_evacuation_logs_household_event'
         AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
         AND c.confrelid = 'public.households'::pg_catalog.regclass
         AND c.conkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[]
         AND c.confkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[])
        OR
        (c.conname = 'fk_evacuation_logs_evacuee_household'
         AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
         AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
         AND c.conkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'evacuee_id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[]
         AND c.confkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[])
        OR
        (c.conname = 'fk_stub_household_event'
         AND c.conrelid = 'public.stubs'::pg_catalog.regclass
         AND c.confrelid = 'public.households'::pg_catalog.regclass
         AND c.conkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[]
         AND c.confkey = ARRAY[
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
           (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
         ]::smallint[])
      )
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — an approved attendance or stub FK name is already used by a different constraint';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conname <> 'fk_evacuation_logs_household_event'
      AND c.conkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confmatchtype = 's' AND c.confupdtype = 'a' AND c.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved attendance event FK exists under another name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conname <> 'fk_evacuation_logs_evacuee_household'
      AND c.conkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'evacuee_id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confmatchtype = 's' AND c.confupdtype = 'a' AND c.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved attendance membership FK exists under another name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.stubs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conname <> 'fk_stub_household_event'
      AND c.conkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confkey = ARRAY[
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped),
        (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.households'::pg_catalog.regclass AND a.attname = 'disaster_event_id' AND a.attnum > 0 AND NOT a.attisdropped)
      ]::smallint[]
      AND c.confmatchtype = 's' AND c.confupdtype = 'a' AND c.confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION BLOCKED — approved stub event FK exists under another name';
  END IF;
END
$$;

-- Create the approved objects. Dynamic DDL is used only so an exact existing
-- object can be recognized without silently replacing it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuation_logs_open_evacuee'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuation_logs'::pg_catalog.regclass
  ) THEN
    EXECUTE $migration$CREATE UNIQUE INDEX uq_evacuation_logs_open_evacuee ON public.evacuation_logs (evacuee_id) WHERE status = 'PRESENT' AND time_out IS NULL$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    WHERE n.nspname = 'public'
      AND idx.relname = 'uq_evacuees_household_family_head'
      AND idx.relkind = 'i'
      AND i.indrelid = 'public.evacuees'::pg_catalog.regclass
  ) THEN
    EXECUTE $migration$CREATE UNIQUE INDEX uq_evacuees_household_family_head ON public.evacuees (household_id) WHERE is_family_head IS TRUE$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_evacuees_id_household'
  ) THEN
    EXECUTE 'ALTER TABLE public.evacuees ADD CONSTRAINT uq_evacuees_id_household UNIQUE (id, household_id)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_households_id_event'
  ) THEN
    EXECUTE 'ALTER TABLE public.households ADD CONSTRAINT uq_households_id_event UNIQUE (id, disaster_event_id)';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_status_time_out'
  ) THEN
    EXECUTE $migration$ALTER TABLE public.evacuation_logs ADD CONSTRAINT chk_evacuation_log_status_time_out CHECK ((status = 'PRESENT' AND time_out IS NULL) OR (status IN ('LEFT', 'TRANSFERRED') AND time_out IS NOT NULL)) NOT VALID$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_same_household'
  ) THEN
    EXECUTE $migration$ALTER TABLE public.households ADD CONSTRAINT fk_households_family_head_same_household FOREIGN KEY (family_head_evacuee_id, id) REFERENCES public.evacuees (id, household_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE SET NULL (family_head_evacuee_id) NOT VALID$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_household_event'
  ) THEN
    EXECUTE $migration$ALTER TABLE public.evacuation_logs ADD CONSTRAINT fk_evacuation_logs_household_event FOREIGN KEY (household_id, disaster_event_id) REFERENCES public.households (id, disaster_event_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE NOT VALID$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_evacuee_household'
  ) THEN
    EXECUTE $migration$ALTER TABLE public.evacuation_logs ADD CONSTRAINT fk_evacuation_logs_evacuee_household FOREIGN KEY (evacuee_id, household_id) REFERENCES public.evacuees (id, household_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE NOT VALID$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_stub_household_event'
  ) THEN
    EXECUTE $migration$ALTER TABLE public.stubs ADD CONSTRAINT fk_stub_household_event FOREIGN KEY (household_id, disaster_event_id) REFERENCES public.households (id, disaster_event_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE NOT VALID$migration$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_status_time_out'
      AND NOT c.convalidated
  ) THEN
    EXECUTE 'ALTER TABLE public.evacuation_logs VALIDATE CONSTRAINT chk_evacuation_log_status_time_out';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_same_household'
      AND NOT c.convalidated
  ) THEN
    EXECUTE 'ALTER TABLE public.households VALIDATE CONSTRAINT fk_households_family_head_same_household';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_household_event'
      AND NOT c.convalidated
  ) THEN
    EXECUTE 'ALTER TABLE public.evacuation_logs VALIDATE CONSTRAINT fk_evacuation_logs_household_event';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_evacuee_household'
      AND NOT c.convalidated
  ) THEN
    EXECUTE 'ALTER TABLE public.evacuation_logs VALIDATE CONSTRAINT fk_evacuation_logs_evacuee_household';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_stub_household_event'
      AND NOT c.convalidated
  ) THEN
    EXECUTE 'ALTER TABLE public.stubs VALIDATE CONSTRAINT fk_stub_household_event';
  END IF;
END
$$;

-- Postconditions keep the transaction fail-closed if any intended object is
-- missing, mismatched, or left unvalidated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public' AND idx.relname = 'uq_evacuation_logs_open_evacuee'
      AND idx.relkind = 'i' AND i.indrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisprimary AND NOT i.indisexclusion
      AND i.indnkeyatts = 1 AND i.indnatts = 1 AND i.indexprs IS NULL AND i.indpred IS NOT NULL
      AND i.indkey[0] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass AND a.attname = 'evacuee_id' AND a.attnum > 0 AND NOT a.attisdropped)
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.regexp_replace(lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)), '[[:space:]]+', '', 'g'), '::(text|character varying|text\[\]|character varying\[\])', '', 'g'), '[()]', '', 'g') = 'status=''present''andtime_outisnull'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — C1 postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class idx
    JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace
    JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid
    JOIN pg_catalog.pg_am am ON am.oid = idx.relam
    WHERE n.nspname = 'public' AND idx.relname = 'uq_evacuees_household_family_head'
      AND idx.relkind = 'i' AND i.indrelid = 'public.evacuees'::pg_catalog.regclass
      AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisprimary AND NOT i.indisexclusion
      AND i.indnkeyatts = 1 AND i.indnatts = 1 AND i.indexprs IS NULL AND i.indpred IS NOT NULL
      AND i.indkey[0] = (SELECT a.attnum FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass AND a.attname = 'household_id' AND a.attnum > 0 AND NOT a.attisdropped)
      AND am.amname = 'btree'
      AND pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.regexp_replace(lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)), '[[:space:]]+', '', 'g'), '::(text|character varying|text\[\]|character varying\[\])', '', 'g'), '[()]', '', 'g') = 'is_family_headistrue'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — C4 postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_status_time_out'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.contype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                lower(pg_catalog.pg_get_constraintdef(c.oid, true)),
                '::character varying\[\]', '', 'g'
              ),
              '::character varying', '', 'g'
            ),
            '::text\[\]', '', 'g'
          ),
          '::text', '', 'g'
        ),
        '[[:space:]]+', '', 'g'
      ) = 'check(status=''present''andtime_outisnullor(status=any(array[''left'',''transferred'']))andtime_outisnotnull)'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — C2 postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_evacuees_id_household'
      AND c.conrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — uq_evacuees_id_household postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'uq_households_id_event'
      AND c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — uq_households_id_event postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_households_family_head_same_household'
      AND c.conrelid = 'public.households'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'family_head_evacuee_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'n'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND pg_catalog.pg_get_constraintdef(c.oid, true) ILIKE '%ON DELETE SET NULL (family_head_evacuee_id)%'
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — fk_households_family_head_same_household postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_household_event'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — fk_evacuation_logs_household_event postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_evacuation_logs_evacuee_household'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.confrelid = 'public.evacuees'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'evacuee_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuation_logs'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.evacuees'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — fk_evacuation_logs_evacuee_household postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'fk_stub_household_event'
      AND c.conrelid = 'public.stubs'::pg_catalog.regclass
      AND c.confrelid = 'public.households'::pg_catalog.regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass
            AND a.attname = 'household_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.stubs'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confkey = ARRAY[
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        ),
        (
          SELECT a.attnum
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.households'::pg_catalog.regclass
            AND a.attname = 'disaster_event_id'
            AND a.attnum > 0
            AND NOT a.attisdropped
        )
      ]::smallint[]
      AND c.confmatchtype = 's'
      AND c.confupdtype = 'a'
      AND c.confdeltype = 'c'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — fk_stub_household_event postcondition mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::pg_catalog.regnamespace
      AND c.conname = 'chk_evacuation_log_time'
      AND c.conrelid = 'public.evacuation_logs'::pg_catalog.regclass
      AND c.contype = 'c' AND c.convalidated
      AND NOT c.condeferrable AND NOT c.condeferred
  ) THEN
    RAISE EXCEPTION 'STAGE-3 MIGRATION FAILED — existing time-order constraint was not preserved';
  END IF;
END
$$;

COMMIT;
