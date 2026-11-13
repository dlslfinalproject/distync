BEGIN;

-- Remove only the proven redundant broad status CHECK.  Every catalog and
-- data guard runs while writes to the target table are blocked.
DO $migration$
DECLARE
  target_table_oid oid;
  status_attnum smallint;
  status_column_count bigint;
  narrow_constraint_count bigint;
  broad_constraint_count bigint;
  unexpected_status_constraint_count bigint;
  narrow_constraint_oid oid;
  broad_constraint_oid oid;
  narrow_contype "char";
  broad_contype "char";
  narrow_conkey smallint[];
  broad_conkey smallint[];
  narrow_convalidated boolean;
  broad_convalidated boolean;
  narrow_condeferrable boolean;
  broad_condeferrable boolean;
  narrow_condeferred boolean;
  broad_condeferred boolean;
  narrow_has_expression boolean;
  broad_has_expression boolean;
  narrow_constraint_definition text;
  broad_constraint_definition text;
  broad_only_count bigint;
  narrow_statuses text[] := ARRAY[
    'AVAILABLE',
    'LOW_STOCK',
    'EXPIRED',
    'DEPLETED',
    'MISSING',
    'DAMAGED'
  ];
  broad_statuses text[] := ARRAY[
    'AVAILABLE',
    'LOW_STOCK',
    'EXPIRED',
    'DEPLETED',
    'DISTRIBUTED',
    'MISSING',
    'DAMAGED',
    'SPOILED',
    'STOLEN'
  ];
  expected_narrow_definition text := $expected_narrow$CHECK (status::text = ANY (ARRAY['AVAILABLE'::character varying::text, 'LOW_STOCK'::character varying::text, 'EXPIRED'::character varying::text, 'DEPLETED'::character varying::text, 'MISSING'::character varying::text, 'DAMAGED'::character varying::text]))$expected_narrow$;
  expected_broad_definition text := $expected_broad$CHECK (status::text = ANY (ARRAY['AVAILABLE'::character varying::text, 'LOW_STOCK'::character varying::text, 'EXPIRED'::character varying::text, 'DEPLETED'::character varying::text, 'DISTRIBUTED'::character varying::text, 'MISSING'::character varying::text, 'DAMAGED'::character varying::text, 'SPOILED'::character varying::text, 'STOLEN'::character varying::text]))$expected_broad$;
BEGIN
  SELECT c.oid
  INTO target_table_oid
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'inventory_batches'
    AND c.relkind = 'r';

  IF target_table_oid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: public.inventory_batches is missing or is not an ordinary table.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    hashtextextended('distync:inventory_batches_status_check_cleanup', 0)
  );

  LOCK TABLE public.inventory_batches
    IN SHARE ROW EXCLUSIVE MODE;

  SELECT COUNT(*)
  INTO status_column_count
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF status_column_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: status column does not exist exactly once.';
  END IF;

  SELECT a.attnum
  INTO status_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = target_table_oid
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT COUNT(*)
  INTO narrow_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'chk_inventory_batch_status';

  IF narrow_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_object',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: exact narrow status constraint is not present once.';
  END IF;

  SELECT c.oid,
         c.contype,
         c.conkey,
         c.convalidated,
         c.condeferrable,
         c.condeferred,
         c.conbin IS NOT NULL,
         pg_catalog.pg_get_constraintdef(c.oid, true)
  INTO narrow_constraint_oid,
       narrow_contype,
       narrow_conkey,
       narrow_convalidated,
       narrow_condeferrable,
       narrow_condeferred,
       narrow_has_expression,
       narrow_constraint_definition
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'chk_inventory_batch_status';

  IF narrow_contype <> 'c'
     OR narrow_conkey IS DISTINCT FROM ARRAY[status_attnum]::smallint[]
     OR NOT narrow_convalidated
     OR narrow_condeferrable
     OR narrow_condeferred
     OR NOT narrow_has_expression
     OR narrow_constraint_definition <> expected_narrow_definition
     OR cardinality(narrow_statuses) <> 6
     OR NOT broad_statuses @> narrow_statuses THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: narrow status contract is unexpected.',
      DETAIL = format('constraint_definition=%s', narrow_constraint_definition);
  END IF;

  SELECT COUNT(*)
  INTO unexpected_status_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.contype = 'c'
    AND (
      c.conkey @> ARRAY[status_attnum]::smallint[]
      OR pg_catalog.pg_get_constraintdef(c.oid, true) ILIKE '%status%'
    )
    AND c.conname NOT IN (
      'chk_inventory_batch_status',
      'inventory_batches_status_check'
    );

  IF unexpected_status_constraint_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: an unexpected status CHECK exists.';
  END IF;

  SELECT COUNT(*)
  INTO broad_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'inventory_batches_status_check';

  IF broad_constraint_count > 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: broad status constraint name resolves more than once.';
  END IF;

  IF broad_constraint_count = 1 THEN
    SELECT c.oid,
           c.contype,
           c.conkey,
           c.convalidated,
           c.condeferrable,
           c.condeferred,
           c.conbin IS NOT NULL,
           pg_catalog.pg_get_constraintdef(c.oid, true)
    INTO broad_constraint_oid,
         broad_contype,
         broad_conkey,
         broad_convalidated,
         broad_condeferrable,
         broad_condeferred,
         broad_has_expression,
         broad_constraint_definition
    FROM pg_catalog.pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conrelid = target_table_oid
      AND c.conname = 'inventory_batches_status_check';

    IF broad_contype <> 'c'
       OR broad_conkey IS DISTINCT FROM ARRAY[status_attnum]::smallint[]
       OR NOT broad_convalidated
       OR broad_condeferrable
       OR broad_condeferred
       OR NOT broad_has_expression
       OR broad_constraint_definition <> expected_broad_definition
       OR cardinality(broad_statuses) <> 9
       OR NOT broad_statuses @> narrow_statuses THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Inventory-batch status-check cleanup preflight failed: broad status constraint definition is unexpected.',
        DETAIL = format('constraint_definition=%s', broad_constraint_definition);
    END IF;
  END IF;

  SELECT COUNT(*)
  INTO broad_only_count
  FROM public.inventory_batches
  WHERE status = ANY (ARRAY['DISTRIBUTED', 'SPOILED', 'STOLEN']);

  IF broad_only_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Inventory-batch status-check cleanup preflight failed: current data requires a broad-only status.',
      DETAIL = format('broad_only_count=%s', broad_only_count);
  END IF;

  -- Runtime, test, migration, and production-safety gates are audited before
  -- this migration is applied.  The catalog/data guards above are the only
  -- database-side state that this forward migration can verify.
  IF broad_constraint_count = 0 THEN
    NULL;
  ELSIF broad_constraint_count = 1 THEN
    ALTER TABLE public.inventory_batches
      DROP CONSTRAINT inventory_batches_status_check;
  END IF;

  SELECT COUNT(*)
  INTO narrow_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'chk_inventory_batch_status'
    AND c.contype = 'c'
    AND c.convalidated
    AND pg_catalog.pg_get_constraintdef(c.oid, true) = expected_narrow_definition;

  IF narrow_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Inventory-batch status-check cleanup postcondition failed: narrow status contract is not exact.';
  END IF;

  SELECT COUNT(*)
  INTO broad_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = target_table_oid
    AND c.conname = 'inventory_batches_status_check';

  IF broad_constraint_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Inventory-batch status-check cleanup postcondition failed: broad status constraint remains.';
  END IF;
END
$migration$;

COMMIT;
