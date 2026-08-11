-- =========================================================
-- DISTYNC INACTIVE INVENTORY ITEMS CLEANUP
-- File: database/seeds/inventory_inactive_items_cleanup.sql
-- Purpose:
-- 1) Remove inactive inventory items created before finalized inventory logic
-- 2) Remove direct inventory-linked child rows for those inactive items
-- 3) Remove audit rows tied to those inactive inventory records
-- 4) Preserve active/current Inventory Items Management records
-- =========================================================

BEGIN;

CREATE TEMP TABLE cleanup_inactive_inventory_items ON COMMIT DROP AS
SELECT id
FROM inventory_items
WHERE is_active IS FALSE;

CREATE TEMP TABLE cleanup_inactive_inventory_stock_forms ON COMMIT DROP AS
SELECT id
FROM inventory_item_stock_forms
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

CREATE TEMP TABLE cleanup_inactive_inventory_batches ON COMMIT DROP AS
SELECT id
FROM inventory_batches
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
)
OR inventory_item_stock_form_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_stock_forms
);

CREATE TEMP TABLE cleanup_inactive_inventory_transactions ON COMMIT DROP AS
SELECT id
FROM inventory_transactions
WHERE inventory_batch_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_batches
);

-- Remove inventory references from distribution item rows only.
DELETE FROM distribution_transaction_items
WHERE inventory_batch_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_batches
)
OR inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove donation item rows tied to inactive inventory items or their batches.
DELETE FROM donation_items
WHERE inventory_batch_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_batches
)
OR inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove relief pack template item rows tied to inactive inventory items.
DELETE FROM relief_pack_template_items
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove donation needs tied to inactive inventory items.
DELETE FROM donation_needs
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove default donation needs tied to inactive inventory items.
DELETE FROM default_emergency_donation_needs
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove forecast outputs tied to inactive inventory items.
DELETE FROM forecast_results
WHERE inventory_item_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove audit rows tied to inactive inventory records before deleting them.
DELETE FROM audit_logs
WHERE (
  entity_type = 'INVENTORY_ITEM'
  AND entity_id IN (
    SELECT id
    FROM cleanup_inactive_inventory_items
  )
)
OR (
  entity_type = 'INVENTORY_ITEM_STOCK_FORM'
  AND entity_id IN (
    SELECT id
    FROM cleanup_inactive_inventory_stock_forms
  )
)
OR (
  entity_type = 'INVENTORY_BATCH'
  AND entity_id IN (
    SELECT id
    FROM cleanup_inactive_inventory_batches
  )
)
OR (
  entity_type = 'INVENTORY_TRANSACTION'
  AND entity_id IN (
    SELECT id
    FROM cleanup_inactive_inventory_transactions
  )
);

-- Remove durable side-effect intents before deleting their inventory transactions.
DELETE FROM inventory_domain_effect_intents
WHERE inventory_transaction_id IN (
  SELECT id
  FROM cleanup_inactive_inventory_transactions
);

-- Remove inventory movement history for inactive items.
DELETE FROM inventory_transactions
WHERE id IN (
  SELECT id
  FROM cleanup_inactive_inventory_transactions
);

-- Remove inactive-item batches before stock forms and items.
DELETE FROM inventory_batches
WHERE id IN (
  SELECT id
  FROM cleanup_inactive_inventory_batches
);

-- Remove stock forms before inactive items.
DELETE FROM inventory_item_stock_forms
WHERE id IN (
  SELECT id
  FROM cleanup_inactive_inventory_stock_forms
);

-- Remove inactive inventory items.
DELETE FROM inventory_items
WHERE id IN (
  SELECT id
  FROM cleanup_inactive_inventory_items
);

-- Remove leftover inventory audit rows whose inventory records no longer exist.
DELETE FROM audit_logs al
WHERE (
  al.entity_type = 'INVENTORY_ITEM'
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_items ii
    WHERE ii.id = al.entity_id
  )
)
OR (
  al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_item_stock_forms iisf
    WHERE iisf.id = al.entity_id
  )
)
OR (
  al.entity_type = 'INVENTORY_BATCH'
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_batches ib
    WHERE ib.id = al.entity_id
  )
)
OR (
  al.entity_type = 'INVENTORY_TRANSACTION'
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_transactions it
    WHERE it.id = al.entity_id
  )
);

COMMIT;
