BEGIN;

-- Keep the existing declarative constraint in place while reconciling its
-- name, then remove only the redundant standalone index.  The preflight is
-- intentionally strict so a partially migrated or unexpected catalog state
-- fails before any DDL is committed.
DO $$
DECLARE
  target_table_oid oid;
  old_constraint_oid oid;
  backing_index_oid oid;
  standalone_index_oid oid;
  key_constraint_count bigint;
  key_index_count bigint;
  duplicate_group_count bigint;
  standalone_dependency_count bigint;
BEGIN
  target_table_oid := 'public.notification_recipients'::regclass;

  -- Prevent writes between the data gate and the metadata changes below.
  EXECUTE 'LOCK TABLE public.notification_recipients IN ACCESS EXCLUSIVE MODE';

  SELECT COUNT(*)
  INTO key_constraint_count
  FROM pg_constraint
  WHERE conrelid = target_table_oid
    AND contype = 'u'
    AND conkey = ARRAY[2, 3]::smallint[];

  IF key_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: expected exactly one UNIQUE constraint on (notification_id, user_id).',
      DETAIL = format('key_constraint_count=%s', key_constraint_count);
  END IF;

  SELECT c.oid, c.conindid
  INTO old_constraint_oid, backing_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'uq_notification_recipient'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[2, 3]::smallint[];

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: expected public.uq_notification_recipient was not found as the canonical-key UNIQUE constraint.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE oid = old_constraint_oid
      AND (
        NOT convalidated
        OR condeferrable
        OR condeferred
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: the retained constraint is not validated and immediate.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_index ix ON ix.indexrelid = i.oid
    WHERE i.oid = backing_index_oid
      AND i.relnamespace = 'public'::regnamespace
      AND i.relname = 'uq_notification_recipient'
      AND i.relam = (SELECT oid FROM pg_am WHERE amname = 'btree')
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
      MESSAGE = 'Notification recipient uniqueness preflight failed: the retained constraint-backed index is not the expected healthy plain B-tree key.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = backing_index_oid
      AND d.refclassid = 'pg_constraint'::regclass
      AND d.refobjid = old_constraint_oid
      AND d.deptype = 'i'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: the retained backing index is not internally owned by uq_notification_recipient.';
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
    AND ix.indoption::text = '0 0'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF key_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: expected exactly two semantically matching UNIQUE implementations before cleanup.',
      DETAIL = format('key_index_count=%s', key_index_count);
  END IF;

  SELECT i.oid
  INTO standalone_index_oid
  FROM pg_class i
  JOIN pg_namespace n ON n.oid = i.relnamespace
  JOIN pg_index ix ON ix.indexrelid = i.oid
  WHERE n.nspname = 'public'
    AND i.relname = 'idx_notification_recipients_unique_delivery'
    AND i.relkind = 'i'
    AND i.relam = (SELECT oid FROM pg_am WHERE amname = 'btree')
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
      MESSAGE = 'Notification recipient uniqueness preflight failed: expected public.idx_notification_recipients_unique_delivery was not found as a healthy standalone duplicate index.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conindid = standalone_index_oid
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: the duplicate index is unexpectedly constraint-backed.';
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
      AND d.refobjsubid IN (2, 3)
    );

  IF standalone_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: the standalone index has an unexpected dependency.',
      DETAIL = format('unexpected_dependency_count=%s', standalone_dependency_count);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class canonical_relation
    WHERE canonical_relation.relname = 'notification_recipients_unique_delivery'
  ) OR EXISTS (
    SELECT 1
    FROM pg_constraint canonical_constraint
    WHERE canonical_constraint.conname = 'notification_recipients_unique_delivery'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Notification recipient uniqueness preflight failed: notification_recipients_unique_delivery is already occupied.';
  END IF;

  SELECT COUNT(*)
  INTO duplicate_group_count
  FROM (
    SELECT notification_id, user_id
    FROM public.notification_recipients
    GROUP BY notification_id, user_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_group_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'unique_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: duplicate logical recipient rows exist.',
      DETAIL = format('duplicate_logical_key_groups=%s', duplicate_group_count);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_recipients
    WHERE notification_id IS NULL
       OR user_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness preflight failed: a logical recipient key is NULL.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index retained
    JOIN pg_index duplicate ON duplicate.indexrelid = standalone_index_oid
    JOIN pg_class retained_relation ON retained_relation.oid = retained.indexrelid
    JOIN pg_class duplicate_relation ON duplicate_relation.oid = duplicate.indexrelid
    WHERE retained.indexrelid = backing_index_oid
      AND retained.indrelid = duplicate.indrelid
      AND retained_relation.relam = duplicate_relation.relam
      AND retained.indisunique = duplicate.indisunique
      AND retained.indisvalid = duplicate.indisvalid
      AND retained.indisready = duplicate.indisready
      AND retained.indislive = duplicate.indislive
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
      MESSAGE = 'Notification recipient uniqueness preflight failed: the two live uniqueness structures are not semantically identical.';
  END IF;
END $$;

ALTER TABLE public.notification_recipients
  RENAME CONSTRAINT uq_notification_recipient
  TO notification_recipients_unique_delivery;

-- PostgreSQL 17.6 renames the internally owned backing index together with
-- the UNIQUE constraint.  Verify that behavior instead of relying on it
-- implicitly; if the catalog disagrees, this transaction aborts before the
-- standalone duplicate can be removed.
DO $$
DECLARE
  canonical_constraint_oid oid;
  canonical_index_oid oid;
  canonical_index_name name;
BEGIN
  SELECT c.oid, c.conindid
  INTO canonical_constraint_oid, canonical_index_oid
  FROM pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = 'public.notification_recipients'::regclass
    AND c.conname = 'notification_recipients_unique_delivery'
    AND c.contype = 'u'
    AND c.conkey = ARRAY[2, 3]::smallint[];

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness rename failed: canonical UNIQUE constraint is missing.';
  END IF;

  SELECT i.relname
  INTO canonical_index_name
  FROM pg_class i
  JOIN pg_index ix ON ix.indexrelid = i.oid
  WHERE i.oid = canonical_index_oid
    AND ix.indisunique
    AND ix.indisvalid
    AND ix.indisready
    AND ix.indislive
    AND i.relname = 'notification_recipients_unique_delivery';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness rename failed: the constraint-backed index was not automatically reconciled to the canonical name.';
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
      MESSAGE = 'Notification recipient uniqueness rename failed: canonical backing-index ownership is not intact.';
  END IF;
END $$;

DROP INDEX public.idx_notification_recipients_unique_delivery;

DO $$
DECLARE
  final_constraint_count bigint;
  final_index_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO final_constraint_count
  FROM pg_constraint c
  WHERE c.conrelid = 'public.notification_recipients'::regclass
    AND c.contype = 'u'
    AND c.conkey = ARRAY[2, 3]::smallint[]
    AND c.conname = 'notification_recipients_unique_delivery';

  SELECT COUNT(*)
  INTO final_index_count
  FROM pg_index ix
  WHERE ix.indrelid = 'public.notification_recipients'::regclass
    AND ix.indisunique
    AND ix.indnkeyatts = 2
    AND ix.indnatts = 2
    AND ix.indkey::text = '2 3'
    AND ix.indpred IS NULL
    AND ix.indexprs IS NULL;

  IF final_constraint_count <> 1 OR final_index_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness postflight failed: expected exactly one canonical UNIQUE implementation.',
      DETAIL = format(
        'final_constraint_count=%s, final_index_count=%s',
        final_constraint_count,
        final_index_count
      );
  END IF;

  IF to_regclass('public.idx_notification_recipients_unique_delivery') IS NOT NULL
     OR to_regclass('public.uq_notification_recipient') IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness postflight failed: a redundant object name remains.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_index ix ON ix.indexrelid = c.conindid
    WHERE c.conrelid = 'public.notification_recipients'::regclass
      AND c.conname = 'notification_recipients_unique_delivery'
      AND c.contype = 'u'
      AND c.convalidated
      AND NOT c.condeferrable
      AND NOT c.condeferred
      AND ix.indisunique
      AND ix.indisvalid
      AND ix.indisready
      AND ix.indislive
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Notification recipient uniqueness postflight failed: canonical uniqueness is not valid, ready, and live.';
  END IF;
END $$;

COMMIT;
