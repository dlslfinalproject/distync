BEGIN;

-- Serialize this narrow catalog/data preflight with other attempts to establish
-- the same business index.
SELECT pg_advisory_xact_lock(
  hashtextextended('distync:relief_pack_templates_name_normalized_unique', 0)
);

DO $guard$
DECLARE
  target_table_oid oid;
  target_table_relkind "char";
  name_column_count integer;
  name_attnum smallint;
  target_relation_count integer;
  target_relation_oid oid;
  target_relation_relkind "char";
  target_index_matches boolean;
  expected_default_collation_oid oid;
  expected_text_ops_oid oid;
  normalized_duplicate_groups bigint;
  equivalent_normalized_indexes bigint;
BEGIN
  SELECT c.oid, c.relkind
  INTO target_table_oid, target_table_relkind
  FROM pg_catalog.pg_class c
  INNER JOIN pg_catalog.pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'relief_pack_templates';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: public.relief_pack_templates does not exist.';
  END IF;

  IF target_table_relkind <> 'r' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: public.relief_pack_templates is not an ordinary table.';
  END IF;

  SELECT COUNT(*)::integer, MIN(a.attnum)::smallint
  INTO name_column_count, name_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'name'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF name_column_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: public.relief_pack_templates.name does not exist exactly once.';
  END IF;

  -- The table lock keeps the duplicate check and index creation in one stable
  -- schema/data window without changing any row.
  LOCK TABLE public.relief_pack_templates IN SHARE MODE;

  SELECT COUNT(*)::bigint
  INTO normalized_duplicate_groups
  FROM (
    SELECT LOWER(BTRIM(name))
    FROM public.relief_pack_templates
    GROUP BY LOWER(BTRIM(name))
    HAVING COUNT(*) > 1
  ) duplicate_groups;

  IF normalized_duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Cannot enforce relief pack template normalized-name uniqueness while duplicate names exist. Resolve duplicate names before applying this migration.',
      DETAIL = format('normalized_duplicate_groups=%s', normalized_duplicate_groups);
  END IF;

  SELECT oid
  INTO expected_default_collation_oid
  FROM pg_catalog.pg_collation
  WHERE oid = 'default'::regcollation;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_object',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: the PostgreSQL default collation could not be resolved.';
  END IF;

  SELECT oc.oid
  INTO expected_text_ops_oid
  FROM pg_catalog.pg_opclass oc
  INNER JOIN pg_catalog.pg_am am
    ON am.oid = oc.opcmethod
  INNER JOIN pg_catalog.pg_namespace opclass_namespace
    ON opclass_namespace.oid = oc.opcnamespace
  WHERE opclass_namespace.nspname = 'pg_catalog'
    AND am.amname = 'btree'
    AND oc.opcname = 'text_ops'
    AND oc.opcintype = 'pg_catalog.text'::regtype;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_object',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: the PostgreSQL btree text operator class could not be resolved.';
  END IF;

  SELECT COUNT(*)::integer, MIN(c.oid)::oid, MIN(c.relkind)::"char"
  INTO target_relation_count, target_relation_oid, target_relation_relkind
  FROM pg_catalog.pg_class c
  INNER JOIN pg_catalog.pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'relief_pack_templates_name_normalized_unique';

  IF target_relation_count > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: the target object name resolves more than once in public.';
  END IF;

  IF target_relation_count = 1 THEN
    IF target_relation_relkind <> 'i' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'wrong_object_type',
        MESSAGE = 'Relief-pack template normalized-name preflight failed: relief_pack_templates_name_normalized_unique is not an ordinary index.';
    END IF;

    SELECT
      i.indrelid = target_table_oid
      AND i.indisunique
      AND NOT i.indisprimary
      AND NOT i.indisexclusion
      AND i.indisvalid
      AND i.indisready
      AND i.indislive
      AND i.indnkeyatts = 1
      AND i.indnatts = 1
      AND i.indkey::text = '0'
      AND i.indoption::text = '0'
      AND i.indcollation IS NOT DISTINCT FROM ARRAY[expected_default_collation_oid]::oidvector
      AND i.indclass IS NOT DISTINCT FROM ARRAY[expected_text_ops_oid]::oidvector
      AND i.indpred IS NULL
      AND i.indexprs IS NOT NULL
      AND am.amname = 'btree'
      AND regexp_replace(
        LOWER(COALESCE(pg_get_expr(i.indexprs, i.indrelid, false), '')),
        '\s+',
        '',
        'g'
      ) IN (
        'lower(btrim(name))',
        'lower(btrim((name)::text))',
        'lower(btrim(name::text))'
      )
      AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'collate'
      AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'text_ops'
    INTO target_index_matches
    FROM pg_catalog.pg_index i
    INNER JOIN pg_catalog.pg_class index_class
      ON index_class.oid = i.indexrelid
    INNER JOIN pg_catalog.pg_am am
      ON am.oid = index_class.relam
    WHERE i.indexrelid = target_relation_oid;

    IF NOT FOUND OR NOT COALESCE(target_index_matches, false) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'duplicate_object',
        MESSAGE = 'Relief-pack template normalized-name preflight failed: the target index name exists with the wrong definition.';
    END IF;
  END IF;

  -- An equivalent unique expression under another name is also unsafe to
  -- coexist with the canonical target. Leave discovery/renaming to an
  -- explicit operator decision.
  SELECT COUNT(*)::bigint
  INTO equivalent_normalized_indexes
  FROM pg_catalog.pg_index i
  INNER JOIN pg_catalog.pg_class index_class
    ON index_class.oid = i.indexrelid
  INNER JOIN pg_catalog.pg_namespace index_namespace
    ON index_namespace.oid = index_class.relnamespace
  INNER JOIN pg_catalog.pg_am am
    ON am.oid = index_class.relam
  WHERE i.indrelid = target_table_oid
    AND index_namespace.nspname = 'public'
    AND index_class.relname <> 'relief_pack_templates_name_normalized_unique'
    AND i.indisunique
    AND NOT i.indisprimary
    AND NOT i.indisexclusion
    AND i.indnkeyatts = 1
    AND i.indnatts = 1
    AND i.indkey::text = '0'
    AND i.indoption::text = '0'
    AND i.indcollation IS NOT DISTINCT FROM ARRAY[expected_default_collation_oid]::oidvector
    AND i.indclass IS NOT DISTINCT FROM ARRAY[expected_text_ops_oid]::oidvector
    AND i.indpred IS NULL
    AND i.indexprs IS NOT NULL
    AND am.amname = 'btree'
    AND regexp_replace(
      LOWER(COALESCE(pg_get_expr(i.indexprs, i.indrelid, false), '')),
      '\s+',
      '',
      'g'
    ) IN (
      'lower(btrim(name))',
      'lower(btrim((name)::text))',
      'lower(btrim(name::text))'
    )
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'collate'
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'text_ops';

  IF equivalent_normalized_indexes > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Relief-pack template normalized-name preflight failed: an equivalent normalized unique index exists under another name.',
      DETAIL = format('equivalent_normalized_indexes=%s', equivalent_normalized_indexes);
  END IF;

  IF target_relation_count = 0 THEN
    EXECUTE 'CREATE UNIQUE INDEX relief_pack_templates_name_normalized_unique ON public.relief_pack_templates USING btree (LOWER(BTRIM(name)))';
  END IF;

  -- Verify the postcondition before committing. The same catalog fields are
  -- used so a same-name object can never silently satisfy this migration.
  SELECT COUNT(*)::integer, MIN(c.oid)::oid, MIN(c.relkind)::"char"
  INTO target_relation_count, target_relation_oid, target_relation_relkind
  FROM pg_catalog.pg_class c
  INNER JOIN pg_catalog.pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'relief_pack_templates_name_normalized_unique';

  IF target_relation_count <> 1 OR target_relation_relkind <> 'i' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Relief-pack template normalized-name postcondition failed: the target index does not exist exactly once as an ordinary index.';
  END IF;

  SELECT
    i.indrelid = target_table_oid
    AND i.indisunique
    AND NOT i.indisprimary
    AND NOT i.indisexclusion
    AND i.indisvalid
    AND i.indisready
    AND i.indislive
    AND i.indnkeyatts = 1
    AND i.indnatts = 1
    AND i.indkey::text = '0'
    AND i.indoption::text = '0'
    AND i.indcollation IS NOT DISTINCT FROM ARRAY[expected_default_collation_oid]::oidvector
    AND i.indclass IS NOT DISTINCT FROM ARRAY[expected_text_ops_oid]::oidvector
    AND i.indpred IS NULL
    AND i.indexprs IS NOT NULL
    AND am.amname = 'btree'
    AND regexp_replace(
      LOWER(COALESCE(pg_get_expr(i.indexprs, i.indrelid, false), '')),
      '\s+',
      '',
      'g'
    ) IN (
      'lower(btrim(name))',
      'lower(btrim((name)::text))',
      'lower(btrim(name::text))'
    )
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'collate'
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'text_ops'
  INTO target_index_matches
  FROM pg_catalog.pg_index i
  INNER JOIN pg_catalog.pg_class index_class
    ON index_class.oid = i.indexrelid
  INNER JOIN pg_catalog.pg_am am
    ON am.oid = index_class.relam
  WHERE i.indexrelid = target_relation_oid;

  IF NOT FOUND OR NOT COALESCE(target_index_matches, false) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Relief-pack template normalized-name postcondition failed: the target index definition is not exact.';
  END IF;

  SELECT COUNT(*)::bigint
  INTO equivalent_normalized_indexes
  FROM pg_catalog.pg_index i
  INNER JOIN pg_catalog.pg_class index_class
    ON index_class.oid = i.indexrelid
  INNER JOIN pg_catalog.pg_namespace index_namespace
    ON index_namespace.oid = index_class.relnamespace
  INNER JOIN pg_catalog.pg_am am
    ON am.oid = index_class.relam
  WHERE i.indrelid = target_table_oid
    AND index_namespace.nspname = 'public'
    AND index_class.relname <> 'relief_pack_templates_name_normalized_unique'
    AND i.indisunique
    AND NOT i.indisprimary
    AND NOT i.indisexclusion
    AND i.indnkeyatts = 1
    AND i.indnatts = 1
    AND i.indkey::text = '0'
    AND i.indoption::text = '0'
    AND i.indcollation IS NOT DISTINCT FROM ARRAY[expected_default_collation_oid]::oidvector
    AND i.indclass IS NOT DISTINCT FROM ARRAY[expected_text_ops_oid]::oidvector
    AND i.indpred IS NULL
    AND i.indexprs IS NOT NULL
    AND am.amname = 'btree'
    AND regexp_replace(
      LOWER(COALESCE(pg_get_expr(i.indexprs, i.indrelid, false), '')),
      '\s+',
      '',
      'g'
    ) IN (
      'lower(btrim(name))',
      'lower(btrim((name)::text))',
      'lower(btrim(name::text))'
    )
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'collate'
    AND LOWER(pg_get_indexdef(i.indexrelid)) !~ 'text_ops';

  IF equivalent_normalized_indexes > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Relief-pack template normalized-name postcondition failed: an equivalent normalized unique index exists under another name.',
      DETAIL = format('equivalent_normalized_indexes=%s', equivalent_normalized_indexes);
  END IF;
END;
$guard$;

COMMIT;
