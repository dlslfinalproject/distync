-- Backfill Packaging Added audit records for stock forms that were created
-- after an item's initial packaging. The first stock form remains part of
-- Item Created; later stock forms represent additional packaging.

BEGIN;

WITH ordered_stock_forms AS (
  SELECT
    iisf.*,
    ROW_NUMBER() OVER (
      PARTITION BY iisf.inventory_item_id
      ORDER BY iisf.created_at ASC, iisf.id ASC
    ) AS form_sequence
  FROM inventory_item_stock_forms iisf
), additional_stock_forms AS (
  SELECT *
  FROM ordered_stock_forms
  WHERE form_sequence > 1
)
UPDATE audit_logs al
SET new_values_json = COALESCE(al.new_values_json, '{}'::jsonb) ||
  jsonb_build_object('is_additional_packaging', true)
FROM additional_stock_forms asf
WHERE al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
  AND al.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
  AND al.entity_id = asf.id
  AND COALESCE(al.new_values_json->>'is_additional_packaging', 'false') <> 'true';

WITH ordered_stock_forms AS (
  SELECT
    iisf.*,
    ROW_NUMBER() OVER (
      PARTITION BY iisf.inventory_item_id
      ORDER BY iisf.created_at ASC, iisf.id ASC
    ) AS form_sequence
  FROM inventory_item_stock_forms iisf
), additional_stock_forms AS (
  SELECT *
  FROM ordered_stock_forms
  WHERE form_sequence > 1
)
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
  COALESCE(batch_actor.created_by, update_actor.user_id, item_actor.user_id),
  COALESCE(
    update_actor.role_code,
    item_actor.role_code,
    'MAYOR'
  ),
  NULL,
  'INVENTORY_ITEM_STOCK_FORM_CREATE',
  'INVENTORY_ITEM_STOCK_FORM',
  asf.id,
  '{}'::jsonb,
  jsonb_build_object(
    'inventory_item_id', asf.inventory_item_id,
    'barcode', asf.barcode,
    'packaging', asf.packaging,
    'units_per_packaging', asf.units_per_packaging,
    'unit_of_measure', asf.unit_of_measure,
    'unit_of_measure_value', asf.unit_of_measure_value,
    'is_active', asf.is_active,
    'is_additional_packaging', true
  ),
  NULL,
  CONCAT('inventory-packaging-added-backfill:', asf.id::text),
  asf.created_at
FROM additional_stock_forms asf
LEFT JOIN LATERAL (
  SELECT ib.created_by
  FROM inventory_batches ib
  WHERE ib.inventory_item_stock_form_id = asf.id
    AND ib.created_by IS NOT NULL
  ORDER BY ib.created_at ASC, ib.id ASC
  LIMIT 1
) batch_actor ON TRUE
LEFT JOIN LATERAL (
  SELECT al.user_id, al.role_code
  FROM audit_logs al
  WHERE al.entity_type = 'INVENTORY_ITEM'
    AND al.entity_id = asf.inventory_item_id
    AND al.action = 'INVENTORY_ITEM_UPDATE'
    AND al.created_at BETWEEN asf.created_at - INTERVAL '10 minutes'
      AND asf.created_at + INTERVAL '10 minutes'
  ORDER BY ABS(EXTRACT(EPOCH FROM (al.created_at - asf.created_at))), al.id
  LIMIT 1
) update_actor ON TRUE
LEFT JOIN LATERAL (
  SELECT al.user_id, al.role_code
  FROM audit_logs al
  WHERE al.entity_type = 'INVENTORY_ITEM'
    AND al.entity_id = asf.inventory_item_id
    AND al.action = 'INVENTORY_ITEM_CREATE'
  ORDER BY al.created_at ASC, al.id ASC
  LIMIT 1
) item_actor ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM audit_logs existing_audit
  WHERE existing_audit.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
    AND existing_audit.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
    AND existing_audit.entity_id = asf.id
)
ON CONFLICT (source_event_key)
WHERE source_event_key IS NOT NULL
DO NOTHING;

COMMIT;
