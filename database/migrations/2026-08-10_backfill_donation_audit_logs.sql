-- Backfill and normalize Donation audit logs.
-- Current Donation audit trail keeps only:
--   DONATION_CREATE      -> Donation Entry
--   DONATION_UPDATE      -> Donation Details Edited
--   DONATION_ITEM_UPDATE -> Donation Details Edited
-- Donation-linked inventory write-offs are displayed from INVENTORY_TRANSACTION logs.
-- Legacy testing/development Donation audit rows at or before
-- 2026-07-28 3:51 PM Asia/Manila are removed so the audit starts from
-- finalized Donation Management records only.

BEGIN;

CREATE TEMP TABLE cleanup_legacy_donations ON COMMIT DROP AS
SELECT id
FROM donations
WHERE created_at <= TIMESTAMPTZ '2026-07-28 15:51:00+08';

CREATE TEMP TABLE cleanup_legacy_donation_items ON COMMIT DROP AS
SELECT
  di.id,
  di.donation_id,
  di.inventory_batch_id
FROM donation_items di
WHERE di.donation_id IN (
  SELECT id
  FROM cleanup_legacy_donations
);

CREATE TEMP TABLE cleanup_legacy_donation_batches ON COMMIT DROP AS
SELECT DISTINCT
  ib.id,
  ib.inventory_item_id
FROM inventory_batches ib
INNER JOIN cleanup_legacy_donation_items cleanup_items
  ON cleanup_items.inventory_batch_id = ib.id
WHERE ib.source_type = 'DONATED';

CREATE TEMP TABLE cleanup_legacy_deletable_donation_batches ON COMMIT DROP AS
SELECT cleanup_batches.id, cleanup_batches.inventory_item_id
FROM cleanup_legacy_donation_batches cleanup_batches
WHERE NOT EXISTS (
  SELECT 1
  FROM distribution_transaction_items dti
  WHERE dti.inventory_batch_id = cleanup_batches.id
);

CREATE TEMP TABLE cleanup_legacy_donation_inventory_transactions ON COMMIT DROP AS
SELECT it.id
FROM inventory_transactions it
WHERE (
  it.reference_type = 'DONATION'
  AND it.reference_id IN (
    SELECT id
    FROM cleanup_legacy_donation_items
  )
)
OR it.inventory_batch_id IN (
  SELECT id
  FROM cleanup_legacy_deletable_donation_batches
);

UPDATE audit_logs
SET action = 'DONATION_CREATE'
WHERE entity_type = 'DONATION'
  AND action IN (
    'DONATION_CREATED',
    'DONATION_ENTRY',
    'DONATION_RECORDED'
  );

UPDATE audit_logs
SET action = 'DONATION_UPDATE'
WHERE entity_type = 'DONATION'
  AND action IN (
    'DONATION_EDIT',
    'DONATION_EDITED',
    'DONATION_UPDATED',
    'DONATION_DETAILS_EDITED'
  );

UPDATE audit_logs
SET action = 'DONATION_ITEM_UPDATE'
WHERE entity_type = 'DONATION_ITEM'
  AND action IN (
    'DONATION_ITEM_EDIT',
    'DONATION_ITEM_EDITED',
    'DONATION_ITEM_UPDATED',
    'DONATION_DETAILS_EDITED'
  );

DELETE FROM audit_logs
WHERE entity_type IN ('DONATION', 'DONATION_ITEM', 'DONATION_NEED')
  AND action NOT IN (
    'DONATION_CREATE',
    'DONATION_UPDATE',
    'DONATION_ITEM_UPDATE'
  );

DELETE FROM audit_logs
WHERE entity_type IN ('DONATION', 'DONATION_ITEM')
  AND created_at <= TIMESTAMPTZ '2026-07-28 15:51:00+08';

DELETE FROM audit_logs al
WHERE al.entity_type = 'INVENTORY_TRANSACTION'
  AND al.action = 'INVENTORY_TRANSACTION_CREATE'
  AND al.new_values_json->>'reference_type' = 'DONATION'
  AND al.created_at <= TIMESTAMPTZ '2026-07-28 15:51:00+08';

DELETE FROM audit_logs
WHERE (
  entity_type = 'DONATION'
  AND entity_id IN (
    SELECT id
    FROM cleanup_legacy_donations
  )
)
OR (
  entity_type = 'DONATION_ITEM'
  AND entity_id IN (
    SELECT id
    FROM cleanup_legacy_donation_items
  )
)
OR (
  entity_type = 'INVENTORY_TRANSACTION'
  AND entity_id IN (
    SELECT id
    FROM cleanup_legacy_donation_inventory_transactions
  )
)
OR (
  entity_type = 'INVENTORY_BATCH'
  AND entity_id IN (
    SELECT id
    FROM cleanup_legacy_deletable_donation_batches
  )
);

DELETE FROM inventory_domain_effect_intents
WHERE inventory_transaction_id IN (
  SELECT id
  FROM cleanup_legacy_donation_inventory_transactions
);

DELETE FROM inventory_transactions
WHERE id IN (
  SELECT id
  FROM cleanup_legacy_donation_inventory_transactions
);

DELETE FROM donation_items
WHERE id IN (
  SELECT id
  FROM cleanup_legacy_donation_items
);

DELETE FROM donations
WHERE id IN (
  SELECT id
  FROM cleanup_legacy_donations
);

DELETE FROM inventory_batches
WHERE id IN (
  SELECT id
  FROM cleanup_legacy_deletable_donation_batches
);

DELETE FROM audit_logs al
WHERE al.entity_type = 'DONATION'
  AND NOT EXISTS (
    SELECT 1
    FROM donations d
    WHERE d.id = al.entity_id
  );

DELETE FROM audit_logs al
WHERE al.entity_type = 'DONATION_ITEM'
  AND NOT EXISTS (
    SELECT 1
    FROM donation_items di
    WHERE di.id = al.entity_id
  );

INSERT INTO audit_logs (
  user_id,
  role_code,
  device_id,
  action,
  entity_type,
  entity_id,
  old_values_json,
  new_values_json,
  ip_address,
  source_event_key,
  created_at
)
SELECT
  d.received_by,
  NULL,
  NULL,
  'DONATION_CREATE',
  'DONATION',
  d.id,
  '{}'::jsonb,
  jsonb_build_object(
    'disaster_event_id', d.disaster_event_id,
    'donor_name', d.donor_name,
    'donor_type', d.donor_type,
    'donor_type_other', d.donor_type_other,
    'contact_information', d.contact_information,
    'received_by', d.received_by,
    'received_at', d.received_at,
    'status', d.status,
    'remarks', d.remarks,
    'item_count', COALESCE(donation_items.item_count, 0),
    'total_quantity_received', COALESCE(donation_items.total_quantity_received, 0),
    'items', COALESCE(donation_items.items, '[]'::jsonb)
  ),
  NULL,
  CONCAT('donation-create-backfill:', d.id::text),
  d.created_at
FROM donations d
LEFT JOIN LATERAL (
  SELECT
    COUNT(di.id)::int AS item_count,
    COALESCE(SUM(di.quantity_received), 0)::int AS total_quantity_received,
    jsonb_agg(
      jsonb_build_object(
        'inventory_item_id', di.inventory_item_id,
        'item_name', ii.item_name,
        'quantity_received', di.quantity_received,
        'unit_of_measure', ii.unit_of_measure,
        'remarks', di.remarks
      )
      ORDER BY di.created_at ASC, ii.item_name ASC
    ) AS items
  FROM donation_items di
  INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
  WHERE di.donation_id = d.id
) donation_items ON TRUE
WHERE d.status <> 'CANCELLED'
  AND d.created_at > TIMESTAMPTZ '2026-07-28 15:51:00+08'
  AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_type = 'DONATION'
      AND al.entity_id = d.id
      AND al.action = 'DONATION_CREATE'
  )
ON CONFLICT (source_event_key)
WHERE source_event_key IS NOT NULL
DO NOTHING;

COMMIT;
