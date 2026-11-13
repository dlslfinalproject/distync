BEGIN;

-- Preserve donation-item provenance by refusing deletion of referenced
-- inventory batches.  This migration changes only the target foreign key.

-- Establish the lockable table contract before taking the migration locks.
DO $$
DECLARE
  donation_items_relkind "char";
  inventory_batches_relkind "char";
BEGIN
  SELECT c.relkind
  INTO donation_items_relkind
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'donation_items';

  SELECT c.relkind
  INTO inventory_batches_relkind
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'inventory_batches';

  IF donation_items_relkind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Donation-item batch FK preflight failed: public.donation_items does not exist.';
  END IF;

  IF inventory_batches_relkind IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_table',
      MESSAGE = 'Donation-item batch FK preflight failed: public.inventory_batches does not exist.';
  END IF;

  IF donation_items_relkind <> 'r' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Donation-item batch FK preflight failed: public.donation_items is not an ordinary table.';
  END IF;

  IF inventory_batches_relkind <> 'r' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'wrong_object_type',
      MESSAGE = 'Donation-item batch FK preflight failed: public.inventory_batches is not an ordinary table.';
  END IF;
END $$;

-- Serialize concurrent attempts and prevent application writes while the
-- catalog/data contract is checked and the single constraint is replaced.
SELECT pg_advisory_xact_lock(
  hashtextextended('distync:donation_items_inventory_batch_id_fkey', 0)
);

LOCK TABLE public.donation_items, public.inventory_batches
  IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  donation_items_oid oid;
  inventory_batches_oid oid;
  source_attnum smallint;
  target_attnum smallint;
  source_column_count bigint;
  target_column_count bigint;
  source_type_oid oid;
  target_type_oid oid;
  source_nullable boolean;
  target_nullable boolean;
  source_default_present boolean;
  source_generated text;
  source_identity text;
  target_constraint_count bigint;
  equivalent_constraint_count bigint;
  target_constraint_oid oid;
  target_conrelid oid;
  target_confrelid oid;
  target_conkey smallint[];
  target_confkey smallint[];
  target_contype text;
  target_confupdtype text;
  target_confdeltype text;
  target_confmatchtype text;
  target_convalidated boolean;
  target_condeferrable boolean;
  target_condeferred boolean;
  target_has_expression boolean;
  target_constraint_def text;
  null_inventory_batch_count bigint;
  orphan_inventory_batch_count bigint;
  non_donated_or_unknown_count bigint;
  inventory_item_mismatch_count bigint;
  post_constraint_count bigint;
  post_equivalent_constraint_count bigint;
BEGIN
  SELECT 'public.donation_items'::regclass,
         'public.inventory_batches'::regclass
  INTO donation_items_oid, inventory_batches_oid;

  -- Verify both columns before inspecting or changing the FK.
  SELECT COUNT(*)
  INTO source_column_count
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = donation_items_oid
    AND a.attname = 'inventory_batch_id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF source_column_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Donation-item batch FK preflight failed: donation_items.inventory_batch_id does not exist exactly once.';
  END IF;

  SELECT a.attnum,
         a.atttypid,
         NOT a.attnotnull,
         COALESCE(ad.adbin IS NOT NULL, false),
         a.attgenerated::text,
         a.attidentity::text
  INTO source_attnum,
       source_type_oid,
       source_nullable,
       source_default_present,
       source_generated,
       source_identity
  FROM pg_catalog.pg_attribute a
  LEFT JOIN pg_catalog.pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
  WHERE a.attrelid = donation_items_oid
    AND a.attname = 'inventory_batch_id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF source_type_oid <> 'pg_catalog.uuid'::regtype
     OR source_nullable IS DISTINCT FROM true
     OR source_default_present
     OR source_generated <> ''
     OR source_identity <> '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK preflight failed: inventory_batch_id column contract is unexpected.';
  END IF;

  SELECT COUNT(*)
  INTO target_column_count
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = inventory_batches_oid
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF target_column_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_column',
      MESSAGE = 'Donation-item batch FK preflight failed: inventory_batches.id does not exist exactly once.';
  END IF;

  SELECT a.attnum,
         a.atttypid,
         NOT a.attnotnull
  INTO target_attnum,
       target_type_oid,
       target_nullable
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = inventory_batches_oid
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF target_type_oid <> 'pg_catalog.uuid'::regtype
     OR target_nullable IS DISTINCT FROM false THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK preflight failed: inventory_batches.id column contract is unexpected.';
  END IF;

  -- The named target must resolve to exactly one FK on the expected source
  -- table.  No compatibility or alternate-constraint guessing is allowed.
  SELECT COUNT(*)
  INTO target_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = donation_items_oid
    AND c.conname = 'donation_items_inventory_batch_id_fkey';

  IF target_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'undefined_object',
      MESSAGE = 'Donation-item batch FK preflight failed: target constraint does not exist exactly once.';
  END IF;

  SELECT c.oid,
         c.conrelid,
         c.confrelid,
         c.conkey,
         c.confkey,
         c.contype::text,
         c.confupdtype::text,
         c.confdeltype::text,
         c.confmatchtype::text,
         c.convalidated,
         c.condeferrable,
         c.condeferred,
         c.conbin IS NOT NULL,
         pg_catalog.pg_get_constraintdef(c.oid, false)
  INTO target_constraint_oid,
       target_conrelid,
       target_confrelid,
       target_conkey,
       target_confkey,
       target_contype,
       target_confupdtype,
       target_confdeltype,
       target_confmatchtype,
       target_convalidated,
       target_condeferrable,
       target_condeferred,
       target_has_expression,
       target_constraint_def
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = donation_items_oid
    AND c.conname = 'donation_items_inventory_batch_id_fkey';

  IF target_contype <> 'f'
     OR target_conrelid <> donation_items_oid
     OR target_confrelid <> inventory_batches_oid
     OR target_conkey IS DISTINCT FROM ARRAY[source_attnum]::smallint[]
     OR target_confkey IS DISTINCT FROM ARRAY[target_attnum]::smallint[]
     OR NOT target_convalidated
     OR target_condeferrable
     OR target_condeferred
     OR target_confupdtype <> 'a'
     OR target_confmatchtype <> 's'
     OR target_has_expression THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK preflight failed: target constraint structure is unexpected.',
      DETAIL = format('constraint_definition=%s', target_constraint_def);
  END IF;

  -- The source/target column pair may have only this one equivalent FK.
  SELECT COUNT(*)
  INTO equivalent_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = donation_items_oid
    AND c.confrelid = inventory_batches_oid
    AND c.conkey IS NOT DISTINCT FROM ARRAY[source_attnum]::smallint[]
    AND c.confkey IS NOT DISTINCT FROM ARRAY[target_attnum]::smallint[];

  IF equivalent_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Donation-item batch FK preflight failed: an equivalent target FK exists more or less than once.';
  END IF;

  IF target_confdeltype NOT IN ('n', 'r') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK preflight failed: ON DELETE action is not SET NULL or RESTRICT.',
      DETAIL = format('constraint_definition=%s', target_constraint_def);
  END IF;

  -- Data guards are read-only and run while both tables are write-locked.
  SELECT COUNT(*) FILTER (WHERE di.inventory_batch_id IS NULL),
         COUNT(*) FILTER (
           WHERE di.inventory_batch_id IS NOT NULL
             AND ib.id IS NULL
         ),
         COUNT(*) FILTER (
           WHERE di.inventory_batch_id IS NOT NULL
             AND (
               ib.id IS NULL
               OR ib.source_type IS DISTINCT FROM 'DONATED'
             )
         ),
         COUNT(*) FILTER (
           WHERE di.inventory_batch_id IS NOT NULL
             AND ib.id IS NOT NULL
             AND di.inventory_item_id IS DISTINCT FROM ib.inventory_item_id
         )
  INTO null_inventory_batch_count,
       orphan_inventory_batch_count,
       non_donated_or_unknown_count,
       inventory_item_mismatch_count
  FROM public.donation_items di
  LEFT JOIN public.inventory_batches ib
    ON ib.id = di.inventory_batch_id;

  IF null_inventory_batch_count <> 0
     OR orphan_inventory_batch_count <> 0
     OR non_donated_or_unknown_count <> 0
     OR inventory_item_mismatch_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK data preflight failed; no schema change was committed.',
      DETAIL = format(
        'null_inventory_batch_count=%s, orphan_inventory_batch_count=%s, non_donated_or_unknown_count=%s, inventory_item_mismatch_count=%s',
        null_inventory_batch_count,
        orphan_inventory_batch_count,
        non_donated_or_unknown_count,
        inventory_item_mismatch_count
      );
  END IF;

  -- State A: exact SET NULL contract.  Replace only the named constraint.
  -- State B: exact RESTRICT contract.  Leave it intact and continue to the
  -- postcondition proof.  All other states fail closed above.
  IF target_confdeltype = 'n' THEN
    EXECUTE 'ALTER TABLE public.donation_items DROP CONSTRAINT donation_items_inventory_batch_id_fkey';
    EXECUTE 'ALTER TABLE public.donation_items ADD CONSTRAINT donation_items_inventory_batch_id_fkey FOREIGN KEY (inventory_batch_id) REFERENCES public.inventory_batches(id) ON UPDATE NO ACTION ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE';
  END IF;

  -- Verify the exact postcondition before COMMIT, including the source and
  -- target column ordering and the one-equivalent-FK invariant.
  SELECT COUNT(*)
  INTO post_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = donation_items_oid
    AND c.conname = 'donation_items_inventory_batch_id_fkey';

  IF post_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK postcondition failed: target constraint does not exist exactly once.';
  END IF;

  SELECT c.confdeltype::text,
         c.confupdtype::text,
         c.confmatchtype::text,
         c.contype::text,
         c.conrelid,
         c.confrelid,
         c.conkey,
         c.confkey,
         c.convalidated,
         c.condeferrable,
         c.condeferred,
         c.conbin IS NOT NULL,
         pg_catalog.pg_get_constraintdef(c.oid, false)
  INTO target_confdeltype,
       target_confupdtype,
       target_confmatchtype,
       target_contype,
       target_conrelid,
       target_confrelid,
       target_conkey,
       target_confkey,
       target_convalidated,
       target_condeferrable,
       target_condeferred,
       target_has_expression,
       target_constraint_def
  FROM pg_catalog.pg_constraint c
  WHERE c.connamespace = 'public'::regnamespace
    AND c.conrelid = donation_items_oid
    AND c.conname = 'donation_items_inventory_batch_id_fkey';

  IF target_contype <> 'f'
     OR target_conrelid <> donation_items_oid
     OR target_confrelid <> inventory_batches_oid
     OR target_conkey IS DISTINCT FROM ARRAY[source_attnum]::smallint[]
     OR target_confkey IS DISTINCT FROM ARRAY[target_attnum]::smallint[]
     OR target_confdeltype <> 'r'
     OR target_confupdtype <> 'a'
     OR target_confmatchtype <> 's'
     OR NOT target_convalidated
     OR target_condeferrable
     OR target_condeferred
     OR target_has_expression THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Donation-item batch FK postcondition failed: exact RESTRICT contract was not established.',
      DETAIL = format('constraint_definition=%s', target_constraint_def);
  END IF;

  SELECT COUNT(*)
  INTO post_equivalent_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = donation_items_oid
    AND c.confrelid = inventory_batches_oid
    AND c.conkey IS NOT DISTINCT FROM ARRAY[source_attnum]::smallint[]
    AND c.confkey IS NOT DISTINCT FROM ARRAY[target_attnum]::smallint[];

  IF post_equivalent_constraint_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'duplicate_object',
      MESSAGE = 'Donation-item batch FK postcondition failed: equivalent target FK count is not exactly one.';
  END IF;
END $$;

COMMIT;
