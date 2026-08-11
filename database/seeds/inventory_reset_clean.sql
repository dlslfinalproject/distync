-- =========================================================
-- DISTYNC CLEAN INVENTORY RESET
-- File: database/seeds/inventory_reset_clean.sql
-- Purpose:
-- 1) Remove current inventory data and direct inventory-linked child rows
-- 2) Preserve unrelated disaster, household, user, and distribution headers
-- 3) Leave the schema intact for a clean reseed
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'default_emergency_donation_needs'
  ) THEN
    EXECUTE $sql$
      DELETE FROM default_emergency_donation_needs
      WHERE inventory_item_id IN (
        SELECT id
        FROM inventory_items
      )
    $sql$;
  END IF;
END $$;

-- Remove inventory references from distribution item rows only.
DELETE FROM distribution_transaction_items
WHERE inventory_batch_id IN (
  SELECT id
  FROM inventory_batches
)
OR inventory_item_id IN (
  SELECT id
  FROM inventory_items
);

-- Remove donation item rows tied to inventory items or batches.
DELETE FROM donation_items
WHERE inventory_batch_id IN (
  SELECT id
  FROM inventory_batches
)
OR inventory_item_id IN (
  SELECT id
  FROM inventory_items
);

-- Remove relief pack template item rows tied to inventory items.
DELETE FROM relief_pack_template_items
WHERE inventory_item_id IN (
  SELECT id
  FROM inventory_items
);

-- Remove donation needs tied to inventory items.
DELETE FROM donation_needs
WHERE inventory_item_id IN (
  SELECT id
  FROM inventory_items
);

-- Remove forecast outputs tied to inventory items.
DELETE FROM forecast_results
WHERE inventory_item_id IN (
  SELECT id
  FROM inventory_items
);

-- Remove audit rows tied to inventory records before deleting the records.
DELETE FROM audit_logs
WHERE (
  entity_type = 'INVENTORY_ITEM'
  AND entity_id IN (
    SELECT id
    FROM inventory_items
  )
)
OR (
  entity_type = 'INVENTORY_ITEM_STOCK_FORM'
  AND entity_id IN (
    SELECT id
    FROM inventory_item_stock_forms
  )
)
OR (
  entity_type = 'INVENTORY_BATCH'
  AND entity_id IN (
    SELECT id
    FROM inventory_batches
  )
)
OR (
  entity_type = 'INVENTORY_TRANSACTION'
  AND entity_id IN (
    SELECT it.id
    FROM inventory_transactions it
    INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
  )
);

-- Remove durable side-effect intents before deleting their inventory transactions.
DELETE FROM inventory_domain_effect_intents
WHERE inventory_transaction_id IN (
  SELECT it.id
  FROM inventory_transactions it
  INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
);

-- Remove inventory movement history.
DELETE FROM inventory_transactions
WHERE inventory_batch_id IN (
  SELECT id
  FROM inventory_batches
);

-- Remove batches before stock forms and items.
DELETE FROM inventory_batches;

-- Remove stock forms before inventory items.
DELETE FROM inventory_item_stock_forms;

-- Remove inventory items.
DELETE FROM inventory_items;

-- Remove relief pack templates that no longer have items.
DELETE FROM relief_pack_templates rpt
WHERE NOT EXISTS (
  SELECT 1
  FROM relief_pack_template_items rpti
  WHERE rpti.template_id = rpt.id
);

-- Remove suppliers that no longer have any batches.
DELETE FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1
  FROM inventory_batches ib
  WHERE ib.supplier_id = s.id
);

COMMIT;
