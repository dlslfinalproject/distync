BEGIN;

-- Retain the canonical declarative constraint and remove only the redundant
-- standalone index.  The preflight is intentionally strict: if the live
-- catalog is no longer the audited two-object state, this transaction aborts
-- before any catalog-changing DDL is committed.
DO $$
DECLARE
  target_table_oid oid;
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  standalone_index_oid oid;
  key_constraint_count bigint;
  key_index_count bigint;
  allowed_dependency_count bigint;
  unexpected_dependency_count bigint;
  external_dependency_count bigint;
  duplicate_group_count bigint;
  null_key_count bigint;
BEGIN
  target_table_oid := 'public.user_roles'::regclass;

  -- Prevent writes between the data/dependency gates and the DDL below.
  EXECUTE 'LOCK TABLE public.user_roles IN ACCESS EXCLUSIVE MODE';

  SELECT COUNT(*)
  INTO key_constraint_count
  FROM pg_constraint
  WHERE conrelid = target_table_oid
    AND contype = 'u'
    AND conkey = ARRAY[2, 3]::smallint[];

  IF key_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: expected exactly one UNIQUE constraint on (user_id, role_id).',
      DETAIL = format('key_constraint_count=%s', key_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_user_role'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[2, 3]::smallint[];

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: public.uq_user_role is not the canonical (user_id, role_id) UNIQUE constraint.';
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
      MESSAGE = 'User-role uniqueness preflight failed: uq_user_role is not validated and immediate.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_am am ON am.oid = i.relam
    WHERE i.oid = canonical_index_oid
      AND i.relnamespace = 'public'::regnamespace
      AND i.relname = 'uq_user_role'
      AND am.amname = 'btree'
      AND ix.indisunique
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
      AND NOT ix.indnullsnotdistinct
      AND ix.indnkeyatts = 2
      AND ix.indnatts = 2
      AND ix.indkey::text = '2 3'
      AND ix.indoption::text = '0 0'
      AND ix.indcollation::text = '0 0'
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: uq_user_role does not have the expected healthy plain B-tree backing index.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = canonical_index_oid
      AND d.refclassid = 'pg_constraint'::regclass
      AND d.refobjid = canonical_constraint_oid
      AND d.deptype = 'i'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: uq_user_role backing index is not internally owned by the canonical constraint.';
  END IF;

  SELECT COUNT(*)
  INTO key_index_count
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  WHERE ix.indrelid = target_table_oid
    AND ix.indisunique
    AND ix.indnkeyatts = 2
    AND ix.indnatts = 2
    AND ix.indkey::text = '2 3'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF key_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: expected exactly two matching UNIQUE implementations before cleanup.',
      DETAIL = format('key_index_count=%s', key_index_count);
  END IF;

  SELECT i.oid
  INTO standalone_index_oid
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index ix ON ix.indexrelid = i.oid
  JOIN pg_am am ON am.oid = i.relam
  WHERE n.nspname = 'public'
    AND i.relname = 'user_roles_user_role_unique'
    AND i.relkind = 'i'
    AND am.amname = 'btree'
    AND ix.indrelid = target_table_oid
    AND ix.indisunique
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND NOT ix.indnullsnotdistinct
    AND ix.indnkeyatts = 2
    AND ix.indnatts = 2
    AND ix.indkey::text = '2 3'
    AND ix.indoption::text = '0 0'
    AND ix.indcollation::text = '0 0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: the expected healthy standalone duplicate index was not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conindid = standalone_index_oid
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: the duplicate index is unexpectedly constraint-backed.';
  END IF;

  SELECT COUNT(*)
  INTO allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.deptype = 'a'
    AND d.refobjsubid IN (2, 3);

  SELECT COUNT(*)
  INTO unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = standalone_index_oid
    AND NOT (
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.deptype = 'a'
      AND d.refobjsubid IN (2, 3)
    );

  IF allowed_dependency_count <> 2 OR unexpected_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: the standalone duplicate index has unexpected dependencies.',
      DETAIL = format(
        'allowed_dependency_count=%s, unexpected_dependency_count=%s',
        allowed_dependency_count,
        unexpected_dependency_count
      );
  END IF;

  SELECT COUNT(*)
  INTO external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = standalone_index_oid;

  IF external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: another database object depends on the standalone duplicate index.',
      DETAIL = format('external_dependency_count=%s', external_dependency_count);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index retained
    JOIN pg_index duplicate ON duplicate.indexrelid = standalone_index_oid
    WHERE retained.indexrelid = canonical_index_oid
      AND retained.indrelid = duplicate.indrelid
      AND retained.indisunique = duplicate.indisunique
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
      MESSAGE = 'User-role uniqueness preflight failed: the canonical and standalone uniqueness structures are not semantically identical.';
  END IF;

  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT user_id, role_id
    FROM public.user_roles
    GROUP BY user_id, role_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_group_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'unique_violation',
      MESSAGE = 'User-role uniqueness preflight failed: duplicate logical role assignments exist.',
      DETAIL = format('duplicate_logical_key_groups=%s', duplicate_group_count);
  END IF;

  SELECT COUNT(*)
  INTO null_key_count
  FROM public.user_roles
  WHERE user_id IS NULL
     OR role_id IS NULL;

  IF null_key_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness preflight failed: a logical role-assignment key is NULL.',
      DETAIL = format('null_logical_key_rows=%s', null_key_count);
  END IF;
END $$;

-- This is deliberately a plain DROP INDEX: no CASCADE and no IF EXISTS.
-- The strict preflight above proves that only the standalone duplicate is
-- being removed while uq_user_role remains continuously enforced.
DROP INDEX public.user_roles_user_role_unique;

DO $$
DECLARE
  final_constraint_count bigint;
  final_index_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO final_constraint_count
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = 'public.user_roles'::regclass
    AND c.conname = 'uq_user_role'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[2, 3]::smallint[]
    AND c.convalidated
    AND NOT c.condeferrable
    AND NOT c.condeferred;

  SELECT COUNT(*)
  INTO final_index_count
  FROM pg_index ix
  WHERE ix.indrelid = 'public.user_roles'::regclass
    AND ix.indisunique
    AND ix.indnkeyatts = 2
    AND ix.indnatts = 2
    AND ix.indkey::text = '2 3'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF final_constraint_count <> 1 OR final_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness postflight failed: expected exactly one canonical UNIQUE implementation.',
      DETAIL = format(
        'final_constraint_count=%s, final_index_count=%s',
        final_constraint_count,
        final_index_count
      );
  END IF;

  IF to_regclass('public.user_roles_user_role_unique') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness postflight failed: the standalone duplicate index still exists.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_index ix ON ix.indexrelid = c.conindid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conrelid = 'public.user_roles'::regclass
      AND c.conname = 'uq_user_role'
      AND c.contype = 'u'
      AND c.conkey = ARRAY[2, 3]::smallint[]
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND i.relname = 'uq_user_role'
      AND am.amname = 'btree'
      AND ix.indisunique
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
      AND NOT ix.indnullsnotdistinct
      AND ix.indnkeyatts = 2
      AND ix.indnatts = 2
      AND ix.indkey::text = '2 3'
      AND ix.indoption::text = '0 0'
      AND ix.indcollation::text = '0 0'
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'User-role uniqueness postflight failed: canonical uniqueness is not valid, ready, live, and correctly keyed.';
  END IF;
END $$;

COMMIT;
