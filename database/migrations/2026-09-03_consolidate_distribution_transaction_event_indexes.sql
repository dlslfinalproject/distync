BEGIN;

-- This migration is intentionally strict.  The table lock keeps the catalog
-- proof and the two index DDL operations in one stable transaction.
DO $$
DECLARE
  target_table_oid oid;
  disaster_event_attnum smallint;
  household_attnum smallint;
  canonical_index_oid oid;
  standalone_index_oid oid;
  canonical_constraint_count bigint;
  standalone_constraint_count bigint;
  canonical_constraint_dependency_count bigint;
  standalone_constraint_dependency_count bigint;
  canonical_allowed_dependency_count bigint;
  canonical_unexpected_dependency_count bigint;
  canonical_external_dependency_count bigint;
  standalone_allowed_dependency_count bigint;
  standalone_unexpected_dependency_count bigint;
  standalone_external_dependency_count bigint;
BEGIN
  IF to_regclass('public.distribution_transactions') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation preflight failed: public.distribution_transactions does not exist.';
  END IF;

  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'distribution_transactions'
    AND c.relkind = 'r';

  IF target_table_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation preflight failed: public.distribution_transactions is not an ordinary table.';
  END IF;

  EXECUTE 'LOCK TABLE public.distribution_transactions IN ACCESS EXCLUSIVE MODE';

  SELECT a.attnum
  INTO disaster_event_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'disaster_event_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  SELECT a.attnum
  INTO household_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'household_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  IF disaster_event_attnum IS NULL OR household_attnum IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation preflight failed: expected UUID disaster_event_id and household_id columns are missing or have changed type.';
  END IF;

  SELECT c.oid
  INTO canonical_index_oid
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transactions_household_event';

  SELECT c.oid
  INTO standalone_index_oid
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transactions_disaster_event_id';

  -- A same-name canonical object is acceptable only when it is the exact
  -- healthy plain B-tree contract that this migration owns.
  IF canonical_index_oid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       INNER JOIN pg_namespace ins ON ins.oid = i.relnamespace
       INNER JOIN pg_index ix ON ix.indexrelid = i.oid
       INNER JOIN pg_class t ON t.oid = ix.indrelid
       INNER JOIN pg_namespace tns ON tns.oid = t.relnamespace
       INNER JOIN pg_am am ON am.oid = i.relam
       INNER JOIN pg_attribute event_column
         ON event_column.attrelid = ix.indrelid
        AND event_column.attnum = ix.indkey[0]
       INNER JOIN pg_attribute household_column
         ON household_column.attrelid = ix.indrelid
        AND household_column.attnum = ix.indkey[1]
       INNER JOIN pg_opclass event_opclass
         ON event_opclass.oid = ix.indclass[0]
       INNER JOIN pg_opclass household_opclass
         ON household_opclass.oid = ix.indclass[1]
       INNER JOIN pg_namespace event_opclass_namespace
         ON event_opclass_namespace.oid = event_opclass.opcnamespace
       INNER JOIN pg_namespace household_opclass_namespace
         ON household_opclass_namespace.oid = household_opclass.opcnamespace
       INNER JOIN pg_am event_opclass_access_method
         ON event_opclass_access_method.oid = event_opclass.opcmethod
       INNER JOIN pg_am household_opclass_access_method
         ON household_opclass_access_method.oid = household_opclass.opcmethod
       WHERE i.oid = canonical_index_oid
         AND ins.nspname = 'public'
         AND i.relname = 'idx_distribution_transactions_household_event'
         AND i.relkind = 'i'
         AND t.oid = target_table_oid
         AND tns.nspname = 'public'
         AND am.amname = 'btree'
         AND NOT ix.indisunique
         AND NOT ix.indisprimary
         AND NOT ix.indisexclusion
         AND ix.indisvalid
         AND ix.indisready
         AND ix.indislive
         AND NOT ix.indnullsnotdistinct
         AND ix.indnkeyatts = 2
         AND ix.indnatts = 2
         AND ix.indkey[0] = disaster_event_attnum
         AND ix.indkey[1] = household_attnum
         AND ix.indoption[0] = 0
         AND ix.indoption[1] = 0
         AND ix.indcollation[0] = 0
         AND ix.indcollation[1] = 0
         AND ix.indpred IS NULL
         AND ix.indexprs IS NULL
         AND event_column.attname = 'disaster_event_id'
         AND event_column.atttypid = 'pg_catalog.uuid'::regtype
         AND household_column.attname = 'household_id'
         AND household_column.atttypid = 'pg_catalog.uuid'::regtype
         AND event_opclass.oid = household_opclass.oid
         AND event_opclass.opcname = 'uuid_ops'
         AND household_opclass.opcname = 'uuid_ops'
         AND event_opclass_namespace.nspname = 'pg_catalog'
         AND household_opclass_namespace.nspname = 'pg_catalog'
         AND event_opclass.opcintype = 'pg_catalog.uuid'::regtype
         AND household_opclass.opcintype = 'pg_catalog.uuid'::regtype
         AND event_opclass_access_method.amname = 'btree'
         AND household_opclass_access_method.amname = 'btree'
         AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transactions_household_event ON public.distribution_transactions USING btree (disaster_event_id, household_id)'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation preflight failed: idx_distribution_transactions_household_event has an unexpected definition.';
  END IF;

  IF canonical_index_oid IS NOT NULL THEN
    SELECT COUNT(*)
    INTO canonical_constraint_count
    FROM pg_constraint c
    WHERE c.conindid = canonical_index_oid;

    SELECT COUNT(*)
    INTO canonical_constraint_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = canonical_index_oid
      AND d.refclassid = 'pg_constraint'::regclass;

    IF canonical_constraint_count <> 0
       OR canonical_constraint_dependency_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution-event index consolidation preflight failed: the canonical event-household index is unexpectedly constraint-owned.',
        DETAIL = format(
          'constraint_count=%s, constraint_dependency_count=%s',
          canonical_constraint_count,
          canonical_constraint_dependency_count
        );
    END IF;

    SELECT COUNT(*)
    INTO canonical_allowed_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = canonical_index_oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid IN (disaster_event_attnum, household_attnum);

    SELECT COUNT(*)
    INTO canonical_unexpected_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = canonical_index_oid
      AND NOT COALESCE(
        d.refclassid = 'pg_class'::regclass
        AND d.refobjid = target_table_oid
        AND d.deptype = 'a'
        AND d.refobjsubid IN (disaster_event_attnum, household_attnum),
        false
      );

    SELECT COUNT(*)
    INTO canonical_external_dependency_count
    FROM pg_depend d
    WHERE d.refclassid = 'pg_class'::regclass
      AND d.refobjid = canonical_index_oid;

    IF canonical_allowed_dependency_count <> 2
       OR canonical_unexpected_dependency_count <> 0
       OR canonical_external_dependency_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution-event index consolidation preflight failed: the canonical event-household index has unexpected dependencies.',
        DETAIL = format(
          'allowed_dependency_count=%s, unexpected_dependency_count=%s, external_dependency_count=%s',
          canonical_allowed_dependency_count,
          canonical_unexpected_dependency_count,
          canonical_external_dependency_count
        );
    END IF;
  END IF;

  -- A same-name standalone object is also fail-closed: the proven drop is
  -- allowed only for the exact ordinary event-leading access path.
  IF standalone_index_oid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       INNER JOIN pg_namespace ins ON ins.oid = i.relnamespace
       INNER JOIN pg_index ix ON ix.indexrelid = i.oid
       INNER JOIN pg_class t ON t.oid = ix.indrelid
       INNER JOIN pg_namespace tns ON tns.oid = t.relnamespace
       INNER JOIN pg_am am ON am.oid = i.relam
       INNER JOIN pg_attribute event_column
         ON event_column.attrelid = ix.indrelid
        AND event_column.attnum = ix.indkey[0]
       INNER JOIN pg_opclass event_opclass
         ON event_opclass.oid = ix.indclass[0]
       INNER JOIN pg_namespace event_opclass_namespace
         ON event_opclass_namespace.oid = event_opclass.opcnamespace
       INNER JOIN pg_am event_opclass_access_method
         ON event_opclass_access_method.oid = event_opclass.opcmethod
       WHERE i.oid = standalone_index_oid
         AND ins.nspname = 'public'
         AND i.relname = 'idx_distribution_transactions_disaster_event_id'
         AND i.relkind = 'i'
         AND t.oid = target_table_oid
         AND tns.nspname = 'public'
         AND am.amname = 'btree'
         AND NOT ix.indisunique
         AND NOT ix.indisprimary
         AND NOT ix.indisexclusion
         AND ix.indisvalid
         AND ix.indisready
         AND ix.indislive
         AND NOT ix.indnullsnotdistinct
         AND ix.indnkeyatts = 1
         AND ix.indnatts = 1
         AND ix.indkey[0] = disaster_event_attnum
         AND ix.indoption[0] = 0
         AND ix.indcollation[0] = 0
         AND ix.indpred IS NULL
         AND ix.indexprs IS NULL
         AND event_column.attname = 'disaster_event_id'
         AND event_column.atttypid = 'pg_catalog.uuid'::regtype
         AND event_opclass.opcname = 'uuid_ops'
         AND event_opclass_namespace.nspname = 'pg_catalog'
         AND event_opclass.opcintype = 'pg_catalog.uuid'::regtype
         AND event_opclass_access_method.amname = 'btree'
         AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transactions_disaster_event_id ON public.distribution_transactions USING btree (disaster_event_id)'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation preflight failed: idx_distribution_transactions_disaster_event_id has an unexpected definition.';
  END IF;

  IF standalone_index_oid IS NOT NULL THEN
    SELECT COUNT(*)
    INTO standalone_constraint_count
    FROM pg_constraint c
    WHERE c.conindid = standalone_index_oid;

    SELECT COUNT(*)
    INTO standalone_constraint_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = standalone_index_oid
      AND d.refclassid = 'pg_constraint'::regclass;

    IF standalone_constraint_count <> 0
       OR standalone_constraint_dependency_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution-event index consolidation preflight failed: the standalone event index is unexpectedly constraint-owned.',
        DETAIL = format(
          'constraint_count=%s, constraint_dependency_count=%s',
          standalone_constraint_count,
          standalone_constraint_dependency_count
        );
    END IF;

    SELECT COUNT(*)
    INTO standalone_allowed_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = standalone_index_oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid = disaster_event_attnum;

    SELECT COUNT(*)
    INTO standalone_unexpected_dependency_count
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = standalone_index_oid
      AND NOT COALESCE(
        d.refclassid = 'pg_class'::regclass
        AND d.refobjid = target_table_oid
        AND d.deptype = 'a'
        AND d.refobjsubid = disaster_event_attnum,
        false
      );

    SELECT COUNT(*)
    INTO standalone_external_dependency_count
    FROM pg_depend d
    WHERE d.refclassid = 'pg_class'::regclass
      AND d.refobjid = standalone_index_oid;

    IF standalone_allowed_dependency_count <> 1
       OR standalone_unexpected_dependency_count <> 0
       OR standalone_external_dependency_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution-event index consolidation preflight failed: the standalone event index has unexpected dependencies.',
        DETAIL = format(
          'allowed_dependency_count=%s, unexpected_dependency_count=%s, external_dependency_count=%s',
          standalone_allowed_dependency_count,
          standalone_unexpected_dependency_count,
          standalone_external_dependency_count
        );
    END IF;
  END IF;

  IF canonical_index_oid IS NULL THEN
    EXECUTE 'CREATE INDEX idx_distribution_transactions_household_event ON public.distribution_transactions USING btree (disaster_event_id, household_id)';

    SELECT c.oid
    INTO canonical_index_oid
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_distribution_transactions_household_event';

    IF canonical_index_oid IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution-event index consolidation failed: canonical event-household index creation did not produce the expected object.';
    END IF;
  END IF;

  -- Verify the retained index after creation or retention and before the
  -- standalone index can be removed.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    INNER JOIN pg_namespace ins ON ins.oid = i.relnamespace
    INNER JOIN pg_index ix ON ix.indexrelid = i.oid
    INNER JOIN pg_class t ON t.oid = ix.indrelid
    INNER JOIN pg_namespace tns ON tns.oid = t.relnamespace
    INNER JOIN pg_am am ON am.oid = i.relam
    INNER JOIN pg_attribute event_column
      ON event_column.attrelid = ix.indrelid
     AND event_column.attnum = ix.indkey[0]
    INNER JOIN pg_attribute household_column
      ON household_column.attrelid = ix.indrelid
     AND household_column.attnum = ix.indkey[1]
    INNER JOIN pg_opclass event_opclass
      ON event_opclass.oid = ix.indclass[0]
    INNER JOIN pg_opclass household_opclass
      ON household_opclass.oid = ix.indclass[1]
    INNER JOIN pg_namespace event_opclass_namespace
      ON event_opclass_namespace.oid = event_opclass.opcnamespace
    INNER JOIN pg_namespace household_opclass_namespace
      ON household_opclass_namespace.oid = household_opclass.opcnamespace
    INNER JOIN pg_am event_opclass_access_method
      ON event_opclass_access_method.oid = event_opclass.opcmethod
    INNER JOIN pg_am household_opclass_access_method
      ON household_opclass_access_method.oid = household_opclass.opcmethod
    WHERE i.oid = canonical_index_oid
      AND ins.nspname = 'public'
      AND i.relname = 'idx_distribution_transactions_household_event'
      AND i.relkind = 'i'
      AND t.oid = target_table_oid
      AND tns.nspname = 'public'
      AND am.amname = 'btree'
      AND NOT ix.indisunique
      AND NOT ix.indisprimary
      AND NOT ix.indisexclusion
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
      AND NOT ix.indnullsnotdistinct
      AND ix.indnkeyatts = 2
      AND ix.indnatts = 2
      AND ix.indkey[0] = disaster_event_attnum
      AND ix.indkey[1] = household_attnum
      AND ix.indoption[0] = 0
      AND ix.indoption[1] = 0
      AND ix.indcollation[0] = 0
      AND ix.indcollation[1] = 0
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
      AND event_column.attname = 'disaster_event_id'
      AND event_column.atttypid = 'pg_catalog.uuid'::regtype
      AND household_column.attname = 'household_id'
      AND household_column.atttypid = 'pg_catalog.uuid'::regtype
      AND event_opclass.oid = household_opclass.oid
      AND event_opclass.opcname = 'uuid_ops'
      AND household_opclass.opcname = 'uuid_ops'
      AND event_opclass_namespace.nspname = 'pg_catalog'
      AND household_opclass_namespace.nspname = 'pg_catalog'
      AND event_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND household_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND event_opclass_access_method.amname = 'btree'
      AND household_opclass_access_method.amname = 'btree'
      AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transactions_household_event ON public.distribution_transactions USING btree (disaster_event_id, household_id)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation failed: retained event-household index did not satisfy the exact post-create contract.';
  END IF;

  SELECT COUNT(*)
  INTO canonical_constraint_count
  FROM pg_constraint c
  WHERE c.conindid = canonical_index_oid;

  SELECT COUNT(*)
  INTO canonical_constraint_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_constraint'::regclass;

  SELECT COUNT(*)
  INTO canonical_allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.deptype = 'a'
    AND d.refobjsubid IN (disaster_event_attnum, household_attnum);

  SELECT COUNT(*)
  INTO canonical_unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND NOT COALESCE(
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid IN (disaster_event_attnum, household_attnum),
      false
    );

  SELECT COUNT(*)
  INTO canonical_external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = canonical_index_oid;

  IF canonical_constraint_count <> 0
     OR canonical_constraint_dependency_count <> 0
     OR canonical_allowed_dependency_count <> 2
     OR canonical_unexpected_dependency_count <> 0
     OR canonical_external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation failed: retained event-household index ownership or dependencies are unsafe.',
      DETAIL = format(
        'constraint_count=%s, constraint_dependency_count=%s, allowed_dependency_count=%s, unexpected_dependency_count=%s, external_dependency_count=%s',
        canonical_constraint_count,
        canonical_constraint_dependency_count,
        canonical_allowed_dependency_count,
        canonical_unexpected_dependency_count,
        canonical_external_dependency_count
      );
  END IF;
END $$;

-- The preflight proved the exact redundant index is ordinary and unowned.
-- This statement intentionally has no dependency override.
DROP INDEX IF EXISTS public.idx_distribution_transactions_disaster_event_id;

DO $$
DECLARE
  target_table_oid oid;
  disaster_event_attnum smallint;
  household_attnum smallint;
  canonical_index_oid oid;
  canonical_constraint_count bigint;
  canonical_constraint_dependency_count bigint;
  canonical_allowed_dependency_count bigint;
  canonical_unexpected_dependency_count bigint;
  canonical_external_dependency_count bigint;
BEGIN
  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'distribution_transactions'
    AND c.relkind = 'r';

  SELECT a.attnum
  INTO disaster_event_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'disaster_event_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  SELECT a.attnum
  INTO household_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'household_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  SELECT c.oid
  INTO canonical_index_oid
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transactions_household_event';

  IF target_table_oid IS NULL
     OR disaster_event_attnum IS NULL
     OR household_attnum IS NULL
     OR canonical_index_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation postcondition failed: canonical table, columns, or index is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    INNER JOIN pg_namespace ins ON ins.oid = i.relnamespace
    INNER JOIN pg_index ix ON ix.indexrelid = i.oid
    INNER JOIN pg_class t ON t.oid = ix.indrelid
    INNER JOIN pg_namespace tns ON tns.oid = t.relnamespace
    INNER JOIN pg_am am ON am.oid = i.relam
    INNER JOIN pg_attribute event_column
      ON event_column.attrelid = ix.indrelid
     AND event_column.attnum = ix.indkey[0]
    INNER JOIN pg_attribute household_column
      ON household_column.attrelid = ix.indrelid
     AND household_column.attnum = ix.indkey[1]
    INNER JOIN pg_opclass event_opclass
      ON event_opclass.oid = ix.indclass[0]
    INNER JOIN pg_opclass household_opclass
      ON household_opclass.oid = ix.indclass[1]
    INNER JOIN pg_namespace event_opclass_namespace
      ON event_opclass_namespace.oid = event_opclass.opcnamespace
    INNER JOIN pg_namespace household_opclass_namespace
      ON household_opclass_namespace.oid = household_opclass.opcnamespace
    INNER JOIN pg_am event_opclass_access_method
      ON event_opclass_access_method.oid = event_opclass.opcmethod
    INNER JOIN pg_am household_opclass_access_method
      ON household_opclass_access_method.oid = household_opclass.opcmethod
    WHERE i.oid = canonical_index_oid
      AND ins.nspname = 'public'
      AND i.relname = 'idx_distribution_transactions_household_event'
      AND i.relkind = 'i'
      AND t.oid = target_table_oid
      AND tns.nspname = 'public'
      AND am.amname = 'btree'
      AND NOT ix.indisunique
      AND NOT ix.indisprimary
      AND NOT ix.indisexclusion
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
      AND NOT ix.indnullsnotdistinct
      AND ix.indnkeyatts = 2
      AND ix.indnatts = 2
      AND ix.indkey[0] = disaster_event_attnum
      AND ix.indkey[1] = household_attnum
      AND ix.indoption[0] = 0
      AND ix.indoption[1] = 0
      AND ix.indcollation[0] = 0
      AND ix.indcollation[1] = 0
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
      AND event_column.attname = 'disaster_event_id'
      AND event_column.atttypid = 'pg_catalog.uuid'::regtype
      AND household_column.attname = 'household_id'
      AND household_column.atttypid = 'pg_catalog.uuid'::regtype
      AND event_opclass.oid = household_opclass.oid
      AND event_opclass.opcname = 'uuid_ops'
      AND household_opclass.opcname = 'uuid_ops'
      AND event_opclass_namespace.nspname = 'pg_catalog'
      AND household_opclass_namespace.nspname = 'pg_catalog'
      AND event_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND household_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND event_opclass_access_method.amname = 'btree'
      AND household_opclass_access_method.amname = 'btree'
      AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transactions_household_event ON public.distribution_transactions USING btree (disaster_event_id, household_id)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation postcondition failed: canonical event-household index has an unexpected definition.';
  END IF;

  SELECT COUNT(*)
  INTO canonical_constraint_count
  FROM pg_constraint c
  WHERE c.conindid = canonical_index_oid;

  SELECT COUNT(*)
  INTO canonical_constraint_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_constraint'::regclass;

  SELECT COUNT(*)
  INTO canonical_allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.deptype = 'a'
    AND d.refobjsubid IN (disaster_event_attnum, household_attnum);

  SELECT COUNT(*)
  INTO canonical_unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND NOT COALESCE(
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid IN (disaster_event_attnum, household_attnum),
      false
    );

  SELECT COUNT(*)
  INTO canonical_external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = canonical_index_oid;

  IF canonical_constraint_count <> 0
     OR canonical_constraint_dependency_count <> 0
     OR canonical_allowed_dependency_count <> 2
     OR canonical_unexpected_dependency_count <> 0
     OR canonical_external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation postcondition failed: canonical index ownership or dependencies are unsafe.';
  END IF;

  IF to_regclass('public.idx_distribution_transactions_disaster_event_id') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution-event index consolidation postcondition failed: standalone event index still exists.';
  END IF;
END $$;

COMMIT;
