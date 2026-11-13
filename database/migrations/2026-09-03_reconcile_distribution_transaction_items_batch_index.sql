BEGIN;

-- Keep the catalog proof and the optional index creation in one stable
-- transaction.  The migration is intentionally limited to this access path.
DO $$
DECLARE
  target_table_oid oid;
  batch_attnum smallint;
  target_object_oid oid;
  target_index_oid oid;
  target_object_count bigint;
  backing_constraint_count bigint;
  constraint_dependency_count bigint;
  allowed_dependency_count bigint;
  unexpected_dependency_count bigint;
  external_dependency_count bigint;
BEGIN
  IF to_regclass('public.distribution_transaction_items') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Distribution item batch-index preflight failed: public.distribution_transaction_items does not exist.';
  END IF;

  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'distribution_transaction_items'
    AND c.relkind = 'r';

  IF target_table_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Distribution item batch-index preflight failed: public.distribution_transaction_items is not an ordinary table.';
  END IF;

  EXECUTE 'LOCK TABLE public.distribution_transaction_items IN ACCESS EXCLUSIVE MODE';

  SELECT a.attnum
  INTO batch_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'inventory_batch_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype;

  IF batch_attnum IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Distribution item batch-index preflight failed: inventory_batch_id is missing or is not UUID.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = target_table_oid
      AND a.attnum = batch_attnum
      AND a.attnotnull
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index preflight failed: inventory_batch_id is nullable.';
  END IF;

  SELECT COUNT(*)
  INTO target_object_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transaction_items_batch';

  IF target_object_count > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Distribution item batch-index preflight failed: the target name resolves to multiple public catalog objects.';
  END IF;

  SELECT c.oid
  INTO target_object_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transaction_items_batch';

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conname = 'idx_distribution_transaction_items_batch'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Distribution item batch-index preflight failed: the target name is already used by a constraint.';
  END IF;

  IF target_object_oid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class i
       WHERE i.oid = target_object_oid
         AND i.relkind = 'i'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Distribution item batch-index preflight failed: the target name is not an index.';
  END IF;

  IF target_object_oid IS NULL THEN
    EXECUTE 'CREATE INDEX idx_distribution_transaction_items_batch ON public.distribution_transaction_items USING btree (inventory_batch_id)';

    SELECT c.oid
    INTO target_index_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_distribution_transaction_items_batch';

    IF target_index_oid IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Distribution item batch-index preflight failed: index creation did not produce the expected object.';
    END IF;
  ELSE
    target_index_oid := target_object_oid;
  END IF;

  -- An existing same-name index is accepted only after this exact catalog
  -- validation.  The same proof also covers the newly created object.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_namespace ins ON ins.oid = i.relnamespace
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace tns ON tns.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    JOIN pg_attribute batch_column
      ON batch_column.attrelid = ix.indrelid
     AND batch_column.attnum = ix.indkey[0]
    JOIN pg_opclass batch_opclass
      ON batch_opclass.oid = ix.indclass[0]
    JOIN pg_namespace batch_opclass_namespace
      ON batch_opclass_namespace.oid = batch_opclass.opcnamespace
    JOIN pg_am batch_opclass_access_method
      ON batch_opclass_access_method.oid = batch_opclass.opcmethod
    WHERE i.oid = target_index_oid
      AND ins.nspname = 'public'
      AND i.relname = 'idx_distribution_transaction_items_batch'
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
      AND ix.indkey[0] = batch_attnum
      AND ix.indoption[0] = 0
      AND ix.indcollation[0] = 0
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
      AND batch_column.attname = 'inventory_batch_id'
      AND batch_column.atttypid = 'pg_catalog.uuid'::regtype
      AND batch_opclass.opcname = 'uuid_ops'
      AND batch_opclass_namespace.nspname = 'pg_catalog'
      AND batch_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND batch_opclass_access_method.amname = 'btree'
      AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transaction_items_batch ON public.distribution_transaction_items USING btree (inventory_batch_id)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index preflight failed: the target index has an unexpected definition.';
  END IF;

  SELECT COUNT(*)
  INTO backing_constraint_count
  FROM pg_constraint c
  WHERE c.conindid = target_index_oid;

  SELECT COUNT(*)
  INTO constraint_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND d.refclassid = 'pg_constraint'::regclass;

  SELECT COUNT(*)
  INTO allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.refobjsubid = batch_attnum
    AND d.deptype = 'a';

  SELECT COUNT(*)
  INTO unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND NOT COALESCE(
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.refobjsubid = batch_attnum
      AND d.deptype = 'a',
      false
    );

  SELECT COUNT(*)
  INTO external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_index_oid;

  IF backing_constraint_count <> 0
     OR constraint_dependency_count <> 0
     OR allowed_dependency_count <> 1
     OR unexpected_dependency_count <> 0
     OR external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index preflight failed: target index ownership or dependencies are unsafe.',
      DETAIL = format(
        'backing_constraint_count=%s, constraint_dependency_count=%s, allowed_dependency_count=%s, unexpected_dependency_count=%s, external_dependency_count=%s',
        backing_constraint_count,
        constraint_dependency_count,
        allowed_dependency_count,
        unexpected_dependency_count,
        external_dependency_count
      );
  END IF;
END $$;

-- Recheck the full contract after retention or creation before committing.
DO $$
DECLARE
  target_table_oid oid;
  batch_attnum smallint;
  target_index_oid oid;
  target_object_count bigint;
  backing_constraint_count bigint;
  constraint_dependency_count bigint;
  allowed_dependency_count bigint;
  unexpected_dependency_count bigint;
  external_dependency_count bigint;
BEGIN
  SELECT c.oid
  INTO target_table_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'distribution_transaction_items'
    AND c.relkind = 'r';

  IF target_table_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Distribution item batch-index postcondition failed: target table is missing or is not an ordinary table.';
  END IF;

  SELECT a.attnum
  INTO batch_attnum
  FROM pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'inventory_batch_id'
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.atttypid = 'pg_catalog.uuid'::regtype
    AND a.attnotnull;

  IF batch_attnum IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index postcondition failed: inventory_batch_id is not UUID NOT NULL.';
  END IF;

  SELECT COUNT(*)
  INTO target_object_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transaction_items_batch';

  IF target_object_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index postcondition failed: target name does not resolve to exactly one public object.';
  END IF;

  SELECT c.oid
  INTO target_index_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'idx_distribution_transaction_items_batch'
    AND c.relkind = 'i';

  IF target_index_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Distribution item batch-index postcondition failed: target object is not an index.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_namespace ins ON ins.oid = i.relnamespace
    JOIN pg_index ix ON ix.indexrelid = i.oid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace tns ON tns.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    JOIN pg_attribute batch_column
      ON batch_column.attrelid = ix.indrelid
     AND batch_column.attnum = ix.indkey[0]
    JOIN pg_opclass batch_opclass
      ON batch_opclass.oid = ix.indclass[0]
    JOIN pg_namespace batch_opclass_namespace
      ON batch_opclass_namespace.oid = batch_opclass.opcnamespace
    JOIN pg_am batch_opclass_access_method
      ON batch_opclass_access_method.oid = batch_opclass.opcmethod
    WHERE i.oid = target_index_oid
      AND ins.nspname = 'public'
      AND i.relname = 'idx_distribution_transaction_items_batch'
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
      AND ix.indkey[0] = batch_attnum
      AND ix.indoption[0] = 0
      AND ix.indcollation[0] = 0
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
      AND batch_column.attname = 'inventory_batch_id'
      AND batch_column.atttypid = 'pg_catalog.uuid'::regtype
      AND batch_opclass.opcname = 'uuid_ops'
      AND batch_opclass_namespace.nspname = 'pg_catalog'
      AND batch_opclass.opcintype = 'pg_catalog.uuid'::regtype
      AND batch_opclass_access_method.amname = 'btree'
      AND pg_get_indexdef(i.oid) = 'CREATE INDEX idx_distribution_transaction_items_batch ON public.distribution_transaction_items USING btree (inventory_batch_id)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index postcondition failed: target index has an unexpected definition.';
  END IF;

  SELECT COUNT(*)
  INTO backing_constraint_count
  FROM pg_constraint c
  WHERE c.conindid = target_index_oid;

  SELECT COUNT(*)
  INTO constraint_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND d.refclassid = 'pg_constraint'::regclass;

  SELECT COUNT(*)
  INTO allowed_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_table_oid
    AND d.refobjsubid = batch_attnum
    AND d.deptype = 'a';

  SELECT COUNT(*)
  INTO unexpected_dependency_count
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = target_index_oid
    AND NOT COALESCE(
      d.refclassid = 'pg_class'::regclass
      AND d.refobjid = target_table_oid
      AND d.refobjsubid = batch_attnum
      AND d.deptype = 'a',
      false
    );

  SELECT COUNT(*)
  INTO external_dependency_count
  FROM pg_depend d
  WHERE d.refclassid = 'pg_class'::regclass
    AND d.refobjid = target_index_oid;

  IF backing_constraint_count <> 0
     OR constraint_dependency_count <> 0
     OR allowed_dependency_count <> 1
     OR unexpected_dependency_count <> 0
     OR external_dependency_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Distribution item batch-index postcondition failed: target index ownership or dependencies are unsafe.',
      DETAIL = format(
        'backing_constraint_count=%s, constraint_dependency_count=%s, allowed_dependency_count=%s, unexpected_dependency_count=%s, external_dependency_count=%s',
        backing_constraint_count,
        constraint_dependency_count,
        allowed_dependency_count,
        unexpected_dependency_count,
        external_dependency_count
      );
  END IF;
END $$;

COMMIT;
