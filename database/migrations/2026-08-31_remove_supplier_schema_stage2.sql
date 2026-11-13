BEGIN;

-- Stage 2 is destructive schema cleanup. Abort before DDL if the verified
-- TEST preflight state has changed. Historical audit and synchronization
-- records are intentionally read-only and are never rewritten here.
DO $$
DECLARE
  supplier_table_exists boolean;
  inventory_batches_table_exists boolean;
  supplier_column_exists boolean;
  supplier_count bigint;
  non_null_batch_supplier_id_count bigint;
  orphan_supplier_reference_count bigint;
  sync_supplier_reference_count bigint;
  pending_failed_supplier_sync_count bigint;
  supplier_conflict_count bigint;
  supplier_notification_count bigint;
  supplier_notification_outbox_count bigint;
  supplier_error_count bigint;
  explicit_supplier_audit_count bigint;
BEGIN
  SELECT to_regclass('public.suppliers') IS NOT NULL
    INTO supplier_table_exists;

  SELECT to_regclass('public.inventory_batches') IS NOT NULL
    INTO inventory_batches_table_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_batches'
      AND column_name = 'supplier_id'
  ) INTO supplier_column_exists;

  IF NOT inventory_batches_table_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Stage 2 Supplier preflight failed: inventory_batches is missing.';
  END IF;

  -- A fully applied migration is a safe no-op. A partially applied state is
  -- rejected so an operator can investigate it instead of guessing.
  IF NOT supplier_table_exists THEN
    IF supplier_column_exists THEN
      RAISE EXCEPTION USING
        ERRCODE = 'check_violation',
        MESSAGE = 'Stage 2 Supplier preflight failed: suppliers is missing but inventory_batches.supplier_id remains.';
    END IF;

    RETURN;
  END IF;

  IF NOT supplier_column_exists THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Stage 2 Supplier preflight failed: suppliers exists but inventory_batches.supplier_id is missing.';
  END IF;

  -- Prevent writes between the data gate and the DDL in this transaction.
  EXECUTE 'LOCK TABLE public.inventory_batches, public.suppliers IN ACCESS EXCLUSIVE MODE';

  SELECT COUNT(*) INTO supplier_count
  FROM public.suppliers;

  SELECT COUNT(*) INTO non_null_batch_supplier_id_count
  FROM public.inventory_batches
  WHERE supplier_id IS NOT NULL;

  SELECT COUNT(*) INTO orphan_supplier_reference_count
  FROM public.inventory_batches ib
  LEFT JOIN public.suppliers s ON s.id = ib.supplier_id
  WHERE ib.supplier_id IS NOT NULL
    AND s.id IS NULL;

  SELECT COUNT(*) INTO sync_supplier_reference_count
  FROM public.sync_transactions
  WHERE entity_type ILIKE '%SUPPLIER%'
     OR payload_json::text ILIKE '%supplier%';

  SELECT COUNT(*) INTO pending_failed_supplier_sync_count
  FROM public.sync_transactions
  WHERE entity_type ILIKE '%SUPPLIER%'
    AND sync_status IN ('PENDING', 'FAILED');

  SELECT COUNT(*) INTO supplier_conflict_count
  FROM public.sync_conflicts
  WHERE entity_type ILIKE '%SUPPLIER%'
     OR local_payload_json::text ILIKE '%supplier_id%'
     OR server_payload_json::text ILIKE '%supplier_id%';

  SELECT COUNT(*) INTO supplier_notification_count
  FROM public.notifications
  WHERE COALESCE(rule_code, '') ILIKE '%SUPPLIER%'
     OR COALESCE(reference_type, '') ILIKE '%SUPPLIER%'
     OR COALESCE(title, '') ILIKE '%SUPPLIER%'
     OR COALESCE(message, '') ILIKE '%SUPPLIER%'
     OR metadata_json::text ILIKE '%supplier%';

  SELECT COUNT(*) INTO supplier_notification_outbox_count
  FROM public.notification_outbox no
  LEFT JOIN public.sync_transactions st ON st.id = no.source_id
  LEFT JOIN public.sync_conflicts sc ON sc.id = no.source_id
  WHERE COALESCE(st.entity_type, '') ILIKE '%SUPPLIER%'
     OR COALESCE(sc.entity_type, '') ILIKE '%SUPPLIER%';

  SELECT COUNT(*) INTO supplier_error_count
  FROM public.error_logs
  WHERE module_name ILIKE '%SUPPLIER%'
     OR COALESCE(error_code, '') ILIKE '%SUPPLIER%'
     OR error_message ILIKE '%SUPPLIER%'
     OR COALESCE(stack_trace, '') ILIKE '%SUPPLIER%'
     OR context_json::text ILIKE '%supplier%';

  SELECT COUNT(*) INTO explicit_supplier_audit_count
  FROM public.audit_logs
  WHERE entity_type ILIKE '%SUPPLIER%'
     OR action ILIKE '%SUPPLIER%';

  IF supplier_count <> 0
     OR non_null_batch_supplier_id_count <> 0
     OR orphan_supplier_reference_count <> 0
     OR sync_supplier_reference_count <> 0
     OR pending_failed_supplier_sync_count <> 0
     OR supplier_conflict_count <> 0
     OR supplier_notification_count <> 0
     OR supplier_notification_outbox_count <> 0
     OR supplier_error_count <> 0
     OR explicit_supplier_audit_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Stage 2 Supplier preflight failed; no schema objects were changed.',
      DETAIL = format(
        'supplier_count=%s, non_null_batch_supplier_id_count=%s, orphan_supplier_reference_count=%s, sync_supplier_reference_count=%s, pending_failed_supplier_sync_count=%s, supplier_conflict_count=%s, supplier_notification_count=%s, supplier_notification_outbox_count=%s, supplier_error_count=%s, explicit_supplier_audit_count=%s',
        supplier_count,
        non_null_batch_supplier_id_count,
        orphan_supplier_reference_count,
        sync_supplier_reference_count,
        pending_failed_supplier_sync_count,
        supplier_conflict_count,
        supplier_notification_count,
        supplier_notification_outbox_count,
        supplier_error_count,
        explicit_supplier_audit_count
      );
  END IF;
END $$;

ALTER TABLE public.inventory_batches
  DROP CONSTRAINT IF EXISTS inventory_batches_supplier_id_fkey;

ALTER TABLE public.inventory_batches
  DROP COLUMN IF EXISTS supplier_id;

DROP TABLE IF EXISTS public.suppliers;

COMMIT;
