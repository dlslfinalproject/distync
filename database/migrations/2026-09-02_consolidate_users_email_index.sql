BEGIN;

-- Retain the declarative UNIQUE constraint and remove only the redundant
-- standalone raw-email index.  The preflight is intentionally strict: if the
-- live TEST catalog is no longer the audited two-object state, this
-- transaction aborts before any catalog-changing DDL is committed.
DO $$
DECLARE
  target_table_oid oid;
  email_attnum smallint;
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  standalone_index_oid oid;
  key_constraint_count bigint;
  raw_email_index_count bigint;
  matching_index_count bigint;
  canonical_dependency_count bigint;
  standalone_allowed_dependency_count bigint;
  standalone_unexpected_dependency_count bigint;
  standalone_external_dependency_count bigint;
  duplicate_group_count bigint;
  null_email_count bigint;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Users-email uniqueness preflight failed: public.users does not exist.';
  END IF;

  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = 'public.users'::regclass
    AND n.nspname = 'public'
    AND c.relkind IN ('r', 'p');

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Users-email uniqueness preflight failed: public.users is not a table.';
  END IF;

  SELECT a.attnum
  INTO email_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'email'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.varchar'::regtype;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Users-email uniqueness preflight failed: public.users.email is not the expected character-varying column.';
  END IF;

  -- Prevent writes between the data/dependency gates and the DDL below.
  EXECUTE 'LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE';

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = target_table_oid
      AND a.attnum = email_attnum
      AND a.attnotnull
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: public.users.email is nullable.';
  END IF;

  SELECT COUNT(*)
  INTO key_constraint_count
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.contype = 'u'
    AND c.conkey = ARRAY[email_attnum]::smallint[];

  IF key_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: expected exactly one UNIQUE constraint on the raw email column.',
      DETAIL = format('raw_email_unique_constraint_count=%s', key_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'users_email_key'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[email_attnum]::smallint[];

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: public.users_email_key is not the canonical raw-email UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE oid = canonical_constraint_oid
      AND (
        NOT convalidated
        OR condeferrable
        OR condeferred
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: users_email_key is not validated and immediate.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_am am ON am.oid = i.relam
    JOIN pg_attribute a
      ON a.attrelid = ix.indrelid
     AND a.attnum = ix.indkey[0]
    JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
    JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
    JOIN pg_collation coll ON coll.oid = ix.indcollation[0]
    JOIN pg_namespace coln ON coln.oid = coll.collnamespace
    WHERE i.oid = canonical_index_oid
      AND i.relnamespace = 'public'::regnamespace
      AND i.relname = 'users_email_key'
      AND i.relkind = 'i'
      AND am.amname = 'btree'
      AND a.attname = 'email'
      AND a.attnum = email_attnum
      AND a.atttypid = 'pg_catalog.varchar'::regtype
      AND a.attcollation = ix.indcollation[0]
      AND opn.nspname = 'pg_catalog'
      AND opc.opcname = 'text_ops'
      AND opc.opcintype = 'text'::regtype
      AND coln.nspname = 'pg_catalog'
      AND coll.collname = 'default'
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND NOT ix.indisexclusion
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
      AND NOT ix.indnullsnotdistinct
      AND ix.indnkeyatts = 1
      AND ix.indnatts = 1
      AND ix.indkey::text = email_attnum::text
      AND ix.indoption::text = '0'
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: users_email_key does not have the expected healthy plain B-tree backing index.';
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
      MESSAGE = 'Users-email uniqueness preflight failed: users_email_key backing index is not internally owned by the canonical constraint.',
      DETAIL = format('internal_constraint_dependency_count=%s', canonical_dependency_count);
  END IF;

  -- Count every plain raw-email index before selecting the two audited
  -- objects.  An additional, partial, expression, included, invalid, or
  -- differently keyed raw-email index must fail closed rather than being
  -- silently left outside this consolidation.
  SELECT COUNT(*)
  INTO raw_email_index_count
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  WHERE ix.indrelid = target_table_oid
    AND i.relnamespace = 'public'::regnamespace
    AND i.relkind = 'i'
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = email_attnum::text
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF raw_email_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: expected exactly two plain raw-email index implementations before cleanup.',
      DETAIL = format('raw_email_index_count=%s', raw_email_index_count);
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
  JOIN pg_collation coll ON coll.oid = ix.indcollation[0]
  JOIN pg_namespace coln ON coln.oid = coll.collnamespace
  WHERE ix.indrelid = target_table_oid
    AND i.relnamespace = 'public'::regnamespace
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND a.attname = 'email'
    AND a.attnum = email_attnum
    AND a.atttypid = 'pg_catalog.varchar'::regtype
    AND a.attcollation = ix.indcollation[0]
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'text_ops'
    AND opc.opcintype = 'text'::regtype
    AND coln.nspname = 'pg_catalog'
    AND coll.collname = 'default'
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = email_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF matching_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: the two raw-email indexes are not the expected healthy plain B-tree implementations.',
      DETAIL = format('matching_index_count=%s', matching_index_count);
  END IF;

  SELECT i.oid
  INTO standalone_index_oid
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  JOIN pg_collation coll ON coll.oid = ix.indcollation[0]
  JOIN pg_namespace coln ON coln.oid = coll.collnamespace
  WHERE n.nspname = 'public'
    AND i.relname = 'idx_users_email'
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND ix.indrelid = target_table_oid
    AND a.attname = 'email'
    AND a.attnum = email_attnum
    AND a.atttypid = 'pg_catalog.varchar'::regtype
    AND a.attcollation = ix.indcollation[0]
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'text_ops'
    AND opc.opcintype = 'text'::regtype
    AND coln.nspname = 'pg_catalog'
    AND coll.collname = 'default'
    AND NOT ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = email_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: public.idx_users_email is not the expected healthy standalone nonunique index.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conindid = standalone_index_oid
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: idx_users_email is unexpectedly constraint-backed.';
  END IF;

  SELECT COUNT(*)
  INTO standalone_allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.deptype = 'a'
    AND d.refobjsubid = email_attnum;

  SELECT COUNT(*)
  INTO standalone_unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND NOT (
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid = email_attnum
    );

  IF standalone_allowed_dependency_count <> 1
     OR standalone_unexpected_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: idx_users_email has unexpected dependencies.',
      DETAIL = format(
        'allowed_dependency_count=%s, unexpected_dependency_count=%s',
        standalone_allowed_dependency_count,
        standalone_unexpected_dependency_count
      );
  END IF;

  SELECT COUNT(*)
  INTO standalone_external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = standalone_index_oid;

  IF standalone_external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: another database object depends on idx_users_email.',
      DETAIL = format('external_dependency_count=%s', standalone_external_dependency_count);
  END IF;

  -- Compare access semantics while allowing the expected unique/nonunique
  -- distinction between the canonical constraint index and the redundant
  -- access path.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index retained
    JOIN pg_index duplicate ON duplicate.indexrelid = standalone_index_oid
    JOIN pg_class retained_relation ON retained_relation.oid = retained.indexrelid
    JOIN pg_class duplicate_relation ON duplicate_relation.oid = duplicate.indexrelid
    WHERE retained.indexrelid = canonical_index_oid
      AND retained_relation.relam = duplicate_relation.relam
      AND retained.indrelid = duplicate.indrelid
      AND retained.indisunique
      AND NOT duplicate.indisunique
      AND retained.indisvalid = duplicate.indisvalid
      AND retained.indisready = duplicate.indisready
      AND retained.indislive = duplicate.indislive
      AND retained.indnullsnotdistinct = duplicate.indnullsnotdistinct
      AND retained.indnkeyatts = duplicate.indnkeyatts
      AND retained.indnatts = duplicate.indnatts
      AND retained.indkey = duplicate.indkey
      AND retained.indoption = duplicate.indoption
      AND retained.indcollation = duplicate.indcollation
      AND retained.indclass = duplicate.indclass
      AND retained.indpred IS NOT DISTINCT FROM duplicate.indpred
      AND retained.indexprs IS NOT DISTINCT FROM duplicate.indexprs
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: users_email_key and idx_users_email do not have equivalent raw-email access semantics.';
  END IF;

  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT email
    FROM public.users
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_group_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'unique_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: duplicate exact stored email values exist.',
      DETAIL = format('duplicate_exact_email_groups=%s', duplicate_group_count);
  END IF;

  SELECT COUNT(*)
  INTO null_email_count
  FROM public.users
  WHERE email IS NULL;

  IF null_email_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness preflight failed: NULL email values exist despite the expected NOT NULL invariant.',
      DETAIL = format('null_email_rows=%s', null_email_count);
  END IF;
END $$;

-- Deliberately plain: the statement has no dependency override or existence
-- fallback.  The strict preflight proves that only the standalone duplicate
-- is being removed while users_email_key remains continuously enforced.
DROP INDEX public.idx_users_email;

DO $$
DECLARE
  target_table_oid oid;
  email_attnum smallint;
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  final_constraint_count bigint;
  final_index_count bigint;
  final_raw_email_index_count bigint;
  canonical_dependency_count bigint;
BEGIN
  target_table_oid := 'public.users'::regclass;

  SELECT a.attnum
  INTO email_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'email'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT COUNT(*)
  INTO final_constraint_count
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'users_email_key'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[email_attnum]::smallint[]
    AND c.convalidated
    AND NOT c.condeferrable
    AND NOT c.condeferred;

  IF final_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness postflight failed: users_email_key is not one validated immediate UNIQUE constraint on email.',
      DETAIL = format('final_constraint_count=%s', final_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'users_email_key'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[email_attnum]::smallint[];

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
      MESSAGE = 'Users-email uniqueness postflight failed: users_email_key backing-index ownership is not intact.',
      DETAIL = format('internal_constraint_dependency_count=%s', canonical_dependency_count);
  END IF;

  SELECT COUNT(*)
  INTO final_raw_email_index_count
  FROM pg_index ix
  WHERE ix.indrelid = target_table_oid
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = email_attnum::text
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  SELECT COUNT(*)
  INTO final_index_count
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a
    ON a.attrelid = ix.indrelid
   AND a.attnum = ix.indkey[0]
  JOIN pg_opclass opc ON opc.oid = ix.indclass[0]
  JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
  JOIN pg_collation coll ON coll.oid = ix.indcollation[0]
  JOIN pg_namespace coln ON coln.oid = coll.collnamespace
  WHERE ix.indexrelid = canonical_index_oid
    AND i.relnamespace = 'public'::regnamespace
    AND i.relname = 'users_email_key'
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND a.attname = 'email'
    AND a.attnum = email_attnum
    AND a.atttypid = 'pg_catalog.varchar'::regtype
    AND a.attcollation = ix.indcollation[0]
    AND opn.nspname = 'pg_catalog'
    AND opc.opcname = 'text_ops'
    AND opc.opcintype = 'text'::regtype
    AND coln.nspname = 'pg_catalog'
    AND coll.collname = 'default'
    AND ix.indisunique
    AND NOT ix.indisprimary
    AND NOT ix.indisexclusion
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 1
    AND ix.indnatts = 1
    AND ix.indkey::text = email_attnum::text
    AND ix.indoption::text = '0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF final_raw_email_index_count <> 1 OR final_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness postflight failed: expected one canonical raw-email index implementation.',
      DETAIL = format(
        'final_raw_email_index_count=%s, final_canonical_index_count=%s',
        final_raw_email_index_count,
        final_index_count
      );
  END IF;

  IF to_regclass('public.idx_users_email') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Users-email uniqueness postflight failed: idx_users_email still exists.';
  END IF;
END $$;

COMMIT;
