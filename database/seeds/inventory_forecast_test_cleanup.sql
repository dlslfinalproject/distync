-- =========================================================
-- DISTYNC INVENTORY + FORECAST TEST CLEANUP
-- File: database/seeds/inventory_forecast_test_cleanup.sql
-- Purpose:
-- 1) Remove only the exact forecast/inventory test data inserted by
--    inventory_forecast_test_seed.sql
-- 2) Preserve unrelated production or earlier seed data
-- 3) Avoid deleting records that still have non-test dependencies
-- =========================================================

BEGIN;

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
),
seeded_templates AS (
  SELECT unnest(ARRAY[
    'Standard Food Pack 1',
    'Standard Family Pack 1',
    'Hygiene Kit',
    'Senior Citizen'
  ]) AS template_name
),
seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)

-- =========================================================
-- 1) REMOVE EXACT SEED-RELATED DEPENDENT RECORDS
-- =========================================================

DELETE FROM distribution_transaction_items
WHERE inventory_batch_id IN (
  SELECT ib.id
  FROM inventory_batches ib
  JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
)
OR inventory_item_id IN (
  SELECT ii.id
  FROM inventory_items ii
  JOIN seeded_items si ON si.item_code = ii.item_code
);

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
),
seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)
DELETE FROM donation_items
WHERE inventory_batch_id IN (
  SELECT ib.id
  FROM inventory_batches ib
  JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
)
OR inventory_item_id IN (
  SELECT ii.id
  FROM inventory_items ii
  JOIN seeded_items si ON si.item_code = ii.item_code
);

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
)
DELETE FROM donation_needs
WHERE disaster_event_id IN (
  SELECT de.id
  FROM disaster_events de
  JOIN seeded_events se ON se.event_code = de.event_code
)
OR inventory_item_id IN (
  SELECT ii.id
  FROM inventory_items ii
  JOIN seeded_items si ON si.item_code = ii.item_code
);

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)
DELETE FROM audit_logs
WHERE (
  entity_type = 'INVENTORY_ITEM'
  AND entity_id IN (
    SELECT ii.id
    FROM inventory_items ii
    JOIN seeded_items si ON si.item_code = ii.item_code
  )
)
OR (
  entity_type = 'INVENTORY_ITEM_STOCK_FORM'
  AND entity_id IN (
    SELECT iisf.id
    FROM inventory_item_stock_forms iisf
    INNER JOIN inventory_items ii ON ii.id = iisf.inventory_item_id
    JOIN seeded_items si ON si.item_code = ii.item_code
  )
)
OR (
  entity_type = 'INVENTORY_BATCH'
  AND entity_id IN (
    SELECT ib.id
    FROM inventory_batches ib
    JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
  )
)
OR (
  entity_type = 'INVENTORY_TRANSACTION'
  AND entity_id IN (
    SELECT it.id
    FROM inventory_transactions it
    LEFT JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
    LEFT JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
    LEFT JOIN disaster_events de ON de.id = it.disaster_event_id
    LEFT JOIN seeded_events se ON se.event_code = de.event_code
    WHERE sb.batch_no IS NOT NULL
       OR se.event_code IS NOT NULL
  )
);

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
),
seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)
DELETE FROM inventory_domain_effect_intents
WHERE inventory_transaction_id IN (
  SELECT it.id
  FROM inventory_transactions it
  LEFT JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
  LEFT JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
  LEFT JOIN disaster_events de ON de.id = it.disaster_event_id
  LEFT JOIN seeded_events se ON se.event_code = de.event_code
  WHERE sb.batch_no IS NOT NULL
     OR se.event_code IS NOT NULL
);

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
),
seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)
DELETE FROM inventory_transactions
WHERE inventory_batch_id IN (
  SELECT ib.id
  FROM inventory_batches ib
  JOIN seeded_batches sb ON sb.batch_no = ib.batch_no
)
OR disaster_event_id IN (
  SELECT de.id
  FROM disaster_events de
  JOIN seeded_events se ON se.event_code = de.event_code
);

-- =========================================================
-- 2) REMOVE EXACT TEMPLATE TEST DATA
-- =========================================================

WITH seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
),
seeded_templates AS (
  SELECT unnest(ARRAY[
    'Standard Food Pack 1',
    'Standard Family Pack 1',
    'Hygiene Kit',
    'Senior Citizen'
  ]) AS template_name
)
DELETE FROM relief_pack_template_items
WHERE template_id IN (
  SELECT rpt.id
  FROM relief_pack_templates rpt
  JOIN seeded_templates st ON st.template_name = rpt.name
)
OR inventory_item_id IN (
  SELECT ii.id
  FROM inventory_items ii
  JOIN seeded_items si ON si.item_code = ii.item_code
);

WITH seeded_templates AS (
  SELECT unnest(ARRAY[
    'Standard Food Pack 1',
    'Standard Family Pack 1',
    'Hygiene Kit',
    'Senior Citizen'
  ]) AS template_name
)
DELETE FROM relief_pack_templates rpt
USING seeded_templates st
WHERE rpt.name = st.template_name
  AND NOT EXISTS (
    SELECT 1
    FROM relief_pack_template_items rpti
    WHERE rpti.template_id = rpt.id
  );

-- =========================================================
-- 3) REMOVE EXACT SEEDED BATCHES
-- =========================================================

WITH seeded_batches AS (
  SELECT unnest(ARRAY[
    'BATCH-RICE-20260210',
    'BATCH-RICE-20260515',
    'BATCH-SARD-20260210',
    'BATCH-CB-20260305',
    'BATCH-NOOD-20260210',
    'BATCH-WATER-20260408',
    'BATCH-COFFEE-20260305',
    'BATCH-SUGAR-20260305',
    'BATCH-MILK-20260408',
    'BATCH-SHAM-20260210',
    'BATCH-SOAP-20260210',
    'BATCH-TP-20260305',
    'BATCH-SN-20260408',
    'BATCH-DIAP-20260408',
    'BATCH-ALC-20260305',
    'BATCH-PARA-20260408',
    'BATCH-ORS-20260408',
    'BATCH-MASK-20260305',
    'BATCH-BLANKET-20260515',
    'BATCH-MALONG-20260515',
    'BATCH-TOWEL-20260515',
    'BATCH-NET-20260515',
    'BATCH-DETERGENT-20260305',
    'BATCH-BLEACH-20260305'
  ]) AS batch_no
)
DELETE FROM inventory_batches ib
USING seeded_batches sb
WHERE ib.batch_no = sb.batch_no;

-- =========================================================
-- 4) REMOVE EXACT SEEDED ITEMS ONLY IF NO BATCH REFERENCES REMAIN
-- =========================================================

WITH seeded_items AS (
  SELECT unnest(ARRAY[
    'INV-FOOD-001',
    'INV-FOOD-002',
    'INV-FOOD-003',
    'INV-FOOD-004',
    'INV-FOOD-005',
    'INV-FOOD-006',
    'INV-FOOD-007',
    'INV-FOOD-008',
    'INV-HYG-001',
    'INV-HYG-002',
    'INV-HYG-003',
    'INV-HYG-004',
    'INV-HYG-005',
    'INV-HYG-006',
    'INV-MED-001',
    'INV-MED-002',
    'INV-MED-003',
    'INV-NFI-001',
    'INV-NFI-002',
    'INV-NFI-003',
    'INV-NFI-004',
    'INV-CLN-001',
    'INV-CLN-002'
  ]) AS item_code
)
DELETE FROM inventory_items ii
USING seeded_items si
WHERE ii.item_code = si.item_code
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_batches ib
    WHERE ib.inventory_item_id = ii.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM relief_pack_template_items rpti
    WHERE rpti.inventory_item_id = ii.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM donation_items di
    WHERE di.inventory_item_id = ii.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM donation_needs dn
    WHERE dn.inventory_item_id = ii.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM distribution_transaction_items dti
    WHERE dti.inventory_item_id = ii.id
  );

-- =========================================================
-- 5) REMOVE EXACT TEST EVENT LINKS AND EVENTS
-- =========================================================

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
)
DELETE FROM disaster_event_barangays deb
USING disaster_events de, seeded_events se
WHERE deb.disaster_event_id = de.id
  AND de.event_code = se.event_code;

WITH seeded_events AS (
  SELECT unnest(ARRAY[
    'DE-2026-0003',
    'DE-2026-0004'
  ]) AS event_code
)
DELETE FROM disaster_events de
USING seeded_events se
WHERE de.event_code = se.event_code
  AND NOT EXISTS (
    SELECT 1
    FROM disaster_event_barangays deb
    WHERE deb.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_transactions it
    WHERE it.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM donation_needs dn
    WHERE dn.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM donations d
    WHERE d.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM households h
    WHERE h.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM stubs s
    WHERE s.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM distribution_transactions dt
    WHERE dt.disaster_event_id = de.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM evacuation_logs el
    WHERE el.disaster_event_id = de.id
  );

-- =========================================================
-- 6) RECOMPUTE SURVIVING INVENTORY QUANTITIES
-- =========================================================

UPDATE inventory_items ii
SET quantity = COALESCE(batch_totals.total_quantity, 0),
    updated_at = NOW()
FROM (
  SELECT inventory_item_id, SUM(quantity_available) AS total_quantity
  FROM inventory_batches
  GROUP BY inventory_item_id
) AS batch_totals
WHERE ii.id = batch_totals.inventory_item_id;

UPDATE inventory_items
SET quantity = 0,
    updated_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT inventory_item_id
  FROM inventory_batches
);

-- =========================================================
-- 8) NORMALIZE SURVIVING BATCH STATUSES
-- =========================================================

UPDATE inventory_batches
SET status = CASE
  WHEN quantity_available = 0 THEN 'DEPLETED'
  WHEN quantity_available <= 20 THEN 'LOW_STOCK'
  ELSE 'AVAILABLE'
END,
updated_at = NOW();

COMMIT;
