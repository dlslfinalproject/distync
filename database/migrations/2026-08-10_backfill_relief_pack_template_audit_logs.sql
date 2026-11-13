-- Backfill and normalize Relief Pack template audit logs.
-- Existing active templates should appear as created records in Audit Trail.

BEGIN;

UPDATE audit_logs
SET action = 'RELIEF_PACK_TEMPLATE_UPDATE'
WHERE entity_type = 'RELIEF_PACK_TEMPLATE'
  AND action IN (
    'RELIEF_PACK_TEMPLATE_UPDATED',
    'RELIEF_PACK_TEMPLATE_ITEMS_UPDATED'
  );

DELETE FROM audit_logs
WHERE entity_type = 'RELIEF_PACK_TEMPLATE'
  AND action NOT IN (
    'RELIEF_PACK_TEMPLATE_CREATE',
    'RELIEF_PACK_TEMPLATE_UPDATE'
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
  rpt.created_by,
  NULL,
  NULL,
  'RELIEF_PACK_TEMPLATE_CREATE',
  'RELIEF_PACK_TEMPLATE',
  rpt.id,
  '{}'::jsonb,
  jsonb_build_object(
    'name', rpt.name,
    'description', rpt.description,
    'based_on_family_size', rpt.based_on_family_size,
    'based_on_sector', rpt.based_on_sector,
    'is_additional_pack', rpt.is_additional_pack,
    'sector_id', rpt.sector_id,
    'sector_ids', CASE
      WHEN rpt.sector_id IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(rpt.sector_id)
    END,
    'applies_to_all_disasters', rpt.applies_to_all_disasters,
    'disaster_types', COALESCE(disaster_types.disaster_types, '[]'::jsonb),
    'is_active', rpt.is_active,
    'items', COALESCE(template_items.items, '[]'::jsonb),
    'usage_summary', NULL
  ),
  NULL,
  CONCAT('relief-pack-template-create-backfill:', rpt.id::text),
  rpt.created_at
FROM relief_pack_templates rpt
LEFT JOIN LATERAL (
  SELECT jsonb_agg(rptdt.disaster_type ORDER BY rptdt.disaster_type) AS disaster_types
  FROM relief_pack_template_disaster_types rptdt
  WHERE rptdt.template_id = rpt.id
) disaster_types ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'inventory_item_id', rpti.inventory_item_id,
      'item_name', ii.item_name,
      'quantity_required', rpti.quantity_required
    )
    ORDER BY ii.item_name
  ) AS items
  FROM relief_pack_template_items rpti
  INNER JOIN inventory_items ii ON ii.id = rpti.inventory_item_id
  WHERE rpti.template_id = rpt.id
) template_items ON TRUE
WHERE rpt.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_type = 'RELIEF_PACK_TEMPLATE'
      AND al.entity_id = rpt.id
      AND al.action = 'RELIEF_PACK_TEMPLATE_CREATE'
  )
ON CONFLICT (source_event_key)
WHERE source_event_key IS NOT NULL
DO NOTHING;

COMMIT;
