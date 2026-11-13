BEGIN;

-- Keep the canonical declarative UNIQUE constraint in place while removing
-- only the redundant standalone index. The preflight is intentionally strict:
-- an unexpected TEST catalog or data state aborts before the DROP statement.
DO $$
DECLARE
  target_table_oid oid;
  stub_attnum smallint;
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  standalone_index_oid oid;
  canonical_constraint_count bigint;
  canonical_index_count bigint;
  canonical_dependency_count bigint;
  standalone_index_count bigint;
  standalone_constraint_count bigint;
  standalone_expected_dependency_count bigint;
  standalone_dependency_count bigint;
  standalone_incoming_dependency_count bigint;
  matching_index_count bigint;
  duplicate_group_count bigint;
  null_stub_count bigint;
BEGIN
  IF to_regclass('public.distribution_transactions') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Distribution stub-index preflight failed: public.distribution_transactions does not exist.';
  END IF;

  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = 'public.distribution_transactions'::regclass
    AND n.nspname = 'public'
    AND c.relkind = 'r';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Distribution stub-index preflight failed: public.distribution_transactions is not an ordinary table.';
  END IF;

  -- Prevent writes between the data/dependency gates and the DDL below.
  EXECUTE 'LOCK TABLE public.distribution_transactions IN ACCESS EXCLUSIVE MODE';

  SELECT a.attnum
  INTO stub_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'stub_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Distribution stub-index preflight failed: public.distribution_transactions.stub_id is not the expected UUID column.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = target_table_oid
      AND a.attnum = stub_attnum
      AND a.attnotnull
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: stub_id is nullable.';
  END IF;

  SELECT COUNT(*)
  INTO canonical_constraint_count
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_distribution_stub'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[stub_attnum]::smallint[];

  IF canonical_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: uq_distribution_stub is not exactly one UNIQUE constraint on stub_id.',
      DETAIL = format('canonical_constraint_count=%s', canonical_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_distribution_stub'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[stub_attnum]::smallint[];

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.oid = canonical_constraint_oid
      AND (
        NOT c.convalidated
        OR c.condeferrable
        OR c.condeferred
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: uq_distribution_stub is not validated and immediate.';
  END IF;

  SELECT COUNT(*)
  INTO canonical_index_count
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  WHERE i.oid = canonical_index_oid
    AND i.relnamespace = 'public'::regnamespace
    AND i.relname = 'uq_distribution_stub'
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND a.attnum = stub_attnum
    AND a.atttypid = 'pg_catalog.uuid'::regtype
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'uuid_ops'
    AND ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = stub_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indcollation::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF canonical_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: uq_distribution_stub backing index is not one healthy plain UUID B-tree.',
      DETAIL = format('canonical_index_count=%s', canonical_index_count);
  END IF;

  SELECT COUNT(*)
  INTO canonical_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_constraint'::regclass
    AND d.refobjid = canonical_constraint_oid
    AND d.deptype = 'i';

  IF canonical_dependency_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: uq_distribution_stub does not internally own its backing index.',
      DETAIL = format('canonical_dependency_count=%s', canonical_dependency_count);
  END IF;

  SELECT COUNT(*)
  INTO standalone_index_count
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  WHERE i.oid = 'public.idx_distribution_transactions_stub_id'::regclass
    AND n.nspname = 'public'
    AND i.relkind = 'i'
    AND ix.indrelid = target_table_oid
    AND am.amname = 'btree'
    AND a.attnum = stub_attnum
    AND a.atttypid = 'pg_catalog.uuid'::regtype
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'uuid_ops'
    AND NOT ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = stub_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indcollation::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF standalone_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: the expected healthy standalone index was not found.',
      DETAIL = format('standalone_index_count=%s', standalone_index_count);
  END IF;

  SELECT 'public.idx_distribution_transactions_stub_id'::regclass
  INTO standalone_index_oid;

  SELECT COUNT(*)
  INTO standalone_constraint_count
  FROM pg_constraint c
  WHERE c.conindid = standalone_index_oid;

  IF standalone_constraint_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: the standalone index is unexpectedly constraint-backed.';
  END IF;

  SELECT COUNT(*)
  INTO standalone_expected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.refobjsubid = stub_attnum
    AND d.deptype = 'a';

  IF standalone_expected_dependency_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: the standalone index does not have exactly one expected table-column dependency.',
      DETAIL = format('expected_dependency_count=%s', standalone_expected_dependency_count);
  END IF;

  SELECT COUNT(*)
  INTO standalone_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND NOT (
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid = stub_attnum
    );

  IF standalone_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: the standalone index has an unexpected dependency.',
      DETAIL = format('unexpected_dependency_count=%s', standalone_dependency_count);
  END IF;

  SELECT COUNT(*)
  INTO standalone_incoming_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = standalone_index_oid;

  IF standalone_incoming_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: another database object depends on the standalone index.',
      DETAIL = format('incoming_dependency_count=%s', standalone_incoming_dependency_count);
  END IF;

  SELECT COUNT(*)
  INTO matching_index_count
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  WHERE i.relnamespace = 'public'::regnamespace
    AND ix.indrelid = target_table_oid
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND a.attnum = stub_attnum
    AND a.atttypid = 'pg_catalog.uuid'::regtype
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'uuid_ops'
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = stub_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indcollation::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF matching_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: expected exactly two semantically matching stub_id B-trees before cleanup.',
      DETAIL = format('matching_index_count=%s', matching_index_count);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index retained
    JOIN pg_index duplicate ON duplicate.indexrelid = standalone_index_oid
    JOIN pg_class retained_relation ON retained_relation.oid = retained.indexrelid
    JOIN pg_class duplicate_relation ON duplicate_relation.oid = duplicate.indexrelid
    WHERE retained.indexrelid = canonical_index_oid
      AND retained.indrelid = duplicate.indrelid
      AND retained_relation.relam = duplicate_relation.relam
      AND retained.indnullsnotdistinct = duplicate.indnullsnotdistinct
      AND retained.indnkeyatts = duplicate.indnkeyatts
      AND retained.indnatts = duplicate.indnatts
      AND retained.indkey::text = duplicate.indkey::text
      AND retained.indoption::text = duplicate.indoption::text
      AND retained.indcollation::text = duplicate.indcollation::text
      AND retained.indclass::text = duplicate.indclass::text
      AND retained.indpred IS NOT DISTINCT FROM duplicate.indpred
      AND retained.indexprs IS NOT DISTINCT FROM duplicate.indexprs
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: canonical and standalone indexes do not have equivalent key semantics.';
  END IF;

  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT stub_id
    FROM public.distribution_transactions
    GROUP BY stub_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_group_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'unique_violation',
      MESSAGE = 'Distribution stub-index preflight failed: duplicate stub_id groups exist.',
      DETAIL = format('duplicate_stub_groups=%s', duplicate_group_count);
  END IF;

  SELECT COUNT(*)
  INTO null_stub_count
  FROM public.distribution_transactions
  WHERE stub_id IS NULL;

  IF null_stub_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index preflight failed: NULL stub_id values exist despite the expected NOT NULL invariant.',
      DETAIL = format('null_stub_rows=%s', null_stub_count);
  END IF;
END $$;

DROP INDEX public.idx_distribution_transactions_stub_id;

DO $$
DECLARE
  target_table_oid oid;
  stub_attnum smallint;
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  final_constraint_count bigint;
  final_index_count bigint;
  final_raw_key_index_count bigint;
  canonical_dependency_count bigint;
BEGIN
  target_table_oid := 'public.distribution_transactions'::regclass;

  SELECT a.attnum
  INTO stub_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'stub_id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT COUNT(*)
  INTO final_constraint_count
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_distribution_stub'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[stub_attnum]::smallint[]
    AND c.convalidated
    AND NOT c.condeferrable
    AND NOT c.condeferred;

  IF final_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index postflight failed: uq_distribution_stub is not one validated immediate UNIQUE constraint on stub_id.',
      DETAIL = format('final_constraint_count=%s', final_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_distribution_stub'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[stub_attnum]::smallint[];

  SELECT COUNT(*)
  INTO canonical_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = canonical_index_oid
    AND d.refclassid = 'pg_constraint'::regclass
    AND d.refobjid = canonical_constraint_oid
    AND d.deptype = 'i';

  IF canonical_dependency_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index postflight failed: canonical backing-index ownership is not intact.';
  END IF;

  SELECT COUNT(*)
  INTO final_raw_key_index_count
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  WHERE i.relnamespace = 'public'::regnamespace
    AND i.relkind = 'i'
    AND ix.indrelid = target_table_oid
    AND i.oid = canonical_index_oid
    AND am.amname = 'btree'
    AND a.attnum = stub_attnum
    AND a.atttypid = 'pg_catalog.uuid'::regtype
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'uuid_ops'
    AND ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = stub_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indcollation::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  SELECT COUNT(*)
  INTO final_index_count
  FROM pg_index ix
  WHERE ix.indrelid = target_table_oid
    AND ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = stub_attnum::text
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF final_raw_key_index_count <> 1 OR final_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index postflight failed: expected exactly one canonical UNIQUE implementation.',
      DETAIL = format(
        'final_canonical_index_count=%s, final_unique_key_index_count=%s',
        final_raw_key_index_count,
        final_index_count
      );
  END IF;

  IF to_regclass('public.idx_distribution_transactions_stub_id') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution stub-index postflight failed: redundant standalone index still exists.';
  END IF;
END $$;

COMMIT;
