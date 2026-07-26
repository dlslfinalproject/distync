-- =========================================================
-- DISTYNC CLEAN INVENTORY STARTER SEED
-- File: database/seeds/inventory_clean_starter_seed.sql
-- Purpose:
-- 1) Seed a small, intentional inventory dataset
-- 2) Cover non-barcoded restock, barcode restock, multi-barcode stock forms,
--    perishable expiry, and measurement-based inventory
-- 3) Align records with the stock-form model
-- =========================================================

BEGIN;

WITH mayor_user AS (
  SELECT id
  FROM users
  WHERE is_active = true
  ORDER BY created_at ASC
  LIMIT 1
),
seed_items AS (
  SELECT *
  FROM (
    VALUES
      (
        'INV-START-NFI-001',
        'Black Blanket',
        'Non-Perishable',
        'pc',
        NULL,
        false,
        true,
        'piece',
        1,
        10,
        1::numeric,
        5,
        NULL::date
      ),
      (
        'INV-START-FOOD-001',
        'Lucky Me! La Paz Batchoy 70g',
        'Non-Perishable',
        'pc',
        '4807770190346',
        false,
        true,
        'pack',
        1,
        24,
        1::numeric,
        12,
        NULL::date
      ),
      (
        'INV-START-FOOD-002',
        'Biscuit A',
        'Non-Perishable',
        'pc',
        NULL,
        false,
        true,
        'pack',
        6,
        12,
        1::numeric,
        24,
        NULL::date
      ),
      (
        'INV-START-FOOD-003',
        'Fresh Eggs',
        'Perishable',
        'pc',
        NULL,
        true,
        true,
        'tray',
        30,
        8,
        1::numeric,
        60,
        DATE '2026-08-12'
      ),
      (
        'INV-START-FOOD-004',
        'Rice',
        'Non-Perishable',
        'kg',
        NULL,
        false,
        true,
        'sack',
        1,
        15,
        5::numeric,
        8,
        NULL::date
      ),
      (
        'INV-START-HYG-001',
        'Bottled Water 500mL',
        'Non-Perishable',
        'mL',
        '4800011122233',
        false,
        true,
        'bottle',
        1,
        48,
        500::numeric,
        24,
        NULL::date
      )
  ) AS seed(
    item_code,
    item_name,
    category,
    unit_of_measure,
    barcode,
    is_perishable,
    is_active,
    packaging,
    quantity,
    packaging_count,
    unit_of_measure_value,
    reorder_level,
    expiration_date
  )
),
inserted_items AS (
  INSERT INTO inventory_items (
    item_code,
    item_name,
    category,
    unit_of_measure,
    barcode,
    is_perishable,
    is_active,
    packaging,
    quantity,
    packaging_count,
    unit_of_measure_value,
    reorder_level,
    expiration_date
  )
  SELECT
    item_code,
    item_name,
    category,
    unit_of_measure,
    barcode,
    is_perishable,
    is_active,
    packaging,
    quantity,
    packaging_count,
    unit_of_measure_value,
    reorder_level,
    expiration_date
  FROM seed_items
  ON CONFLICT (item_name) DO UPDATE
  SET item_code = EXCLUDED.item_code,
      category = EXCLUDED.category,
      unit_of_measure = EXCLUDED.unit_of_measure,
      barcode = EXCLUDED.barcode,
      is_perishable = EXCLUDED.is_perishable,
      is_active = EXCLUDED.is_active,
      packaging = EXCLUDED.packaging,
      quantity = EXCLUDED.quantity,
      packaging_count = EXCLUDED.packaging_count,
      unit_of_measure_value = EXCLUDED.unit_of_measure_value,
      reorder_level = EXCLUDED.reorder_level,
      expiration_date = EXCLUDED.expiration_date,
      updated_at = NOW()
  RETURNING id, item_code, item_name, unit_of_measure, unit_of_measure_value, packaging, quantity, is_active
),
inserted_stock_forms AS (
  INSERT INTO inventory_item_stock_forms (
    inventory_item_id,
    barcode,
    packaging,
    units_per_packaging,
    unit_of_measure,
    unit_of_measure_value,
    is_active
  )
  SELECT
    ii.id,
    CASE ii.item_code
      WHEN 'INV-START-FOOD-001' THEN '4807770190346'
      WHEN 'INV-START-HYG-001' THEN '4800011122233'
      ELSE NULL
    END,
    ii.packaging,
    ii.quantity,
    ii.unit_of_measure,
    ii.unit_of_measure_value,
    ii.is_active
  FROM inserted_items ii
  WHERE ii.item_code <> 'INV-START-FOOD-002'

  UNION ALL

  SELECT
    ii.id,
    '4809990000001',
    'piece',
    1,
    'pc',
    1,
    true
  FROM inserted_items ii
  WHERE ii.item_code = 'INV-START-FOOD-002'

  UNION ALL

  SELECT
    ii.id,
    '4809990000002',
    'pack',
    6,
    'pc',
    1,
    true
  FROM inserted_items ii
  WHERE ii.item_code = 'INV-START-FOOD-002'

  UNION ALL

  SELECT
    ii.id,
    '4809990000003',
    'box',
    24,
    'pc',
    1,
    true
  FROM inserted_items ii
  WHERE ii.item_code = 'INV-START-FOOD-002'

  UNION ALL

  SELECT
    ii.id,
    NULL,
    'box',
    20,
    'pc',
    1,
    true
  FROM inserted_items ii
  WHERE ii.item_code = 'INV-START-NFI-001'

  RETURNING id, inventory_item_id, barcode, packaging, units_per_packaging, unit_of_measure
),
inserted_batches AS (
  INSERT INTO inventory_batches (
    inventory_item_id,
    inventory_item_stock_form_id,
    batch_no,
    supplier_id,
    source_type,
    quantity_received,
    quantity_available,
    expiration_date,
    received_at,
    storage_location,
    status,
    created_by
  )
  SELECT
    ii.id,
    sf.id,
    CASE
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'piece'
        THEN 'INV-START-NFI-001-OPEN-001'
      WHEN ii.item_code = 'INV-START-FOOD-001'
        THEN 'INV-START-FOOD-001-OPEN-001'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000002'
        THEN 'INV-START-FOOD-002-OPEN-001'
      WHEN ii.item_code = 'INV-START-FOOD-003'
        THEN 'INV-START-FOOD-003-OPEN-001'
      WHEN ii.item_code = 'INV-START-FOOD-004'
        THEN 'INV-START-FOOD-004-OPEN-001'
      WHEN ii.item_code = 'INV-START-HYG-001'
        THEN 'INV-START-HYG-001-OPEN-001'
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'box'
        THEN 'INV-START-NFI-001-RESTOCK-001'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000001'
        THEN 'INV-START-FOOD-002-RESTOCK-PIECE-001'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000003'
        THEN 'INV-START-FOOD-002-RESTOCK-BOX-001'
    END AS batch_no,
    NULL AS supplier_id,
    'LGU' AS source_type,
    CASE
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'piece' THEN 10
      WHEN ii.item_code = 'INV-START-FOOD-001' THEN 24
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000002' THEN 72
      WHEN ii.item_code = 'INV-START-FOOD-003' THEN 240
      WHEN ii.item_code = 'INV-START-FOOD-004' THEN 15
      WHEN ii.item_code = 'INV-START-HYG-001' THEN 48
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'box' THEN 20
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000001' THEN 30
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000003' THEN 48
    END AS quantity_received,
    CASE
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'piece' THEN 10
      WHEN ii.item_code = 'INV-START-FOOD-001' THEN 24
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000002' THEN 72
      WHEN ii.item_code = 'INV-START-FOOD-003' THEN 240
      WHEN ii.item_code = 'INV-START-FOOD-004' THEN 15
      WHEN ii.item_code = 'INV-START-HYG-001' THEN 48
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'box' THEN 20
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000001' THEN 30
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000003' THEN 48
    END AS quantity_available,
    CASE
      WHEN ii.item_code = 'INV-START-FOOD-003' THEN DATE '2026-08-12'
      ELSE NULL
    END AS expiration_date,
    CASE
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'piece'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-01 09:00:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-001'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-02 09:15:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000002'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-03 10:00:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-003'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-04 08:45:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-004'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-05 11:20:00+08'
      WHEN ii.item_code = 'INV-START-HYG-001'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-06 09:30:00+08'
      WHEN ii.item_code = 'INV-START-NFI-001' AND sf.packaging = 'box'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-12 14:00:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000001'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-13 10:30:00+08'
      WHEN ii.item_code = 'INV-START-FOOD-002' AND sf.barcode = '4809990000003'
        THEN TIMESTAMP WITH TIME ZONE '2026-07-14 15:10:00+08'
    END AS received_at,
    'Mayor''s Office Inventory' AS storage_location,
    'AVAILABLE' AS status,
    (SELECT id FROM mayor_user) AS created_by
  FROM inserted_items ii
  INNER JOIN inserted_stock_forms sf
    ON sf.inventory_item_id = ii.id
  WHERE
    (ii.item_code = 'INV-START-NFI-001' AND sf.packaging IN ('piece', 'box'))
    OR (ii.item_code = 'INV-START-FOOD-001')
    OR (ii.item_code = 'INV-START-FOOD-002' AND sf.barcode IN (
      '4809990000001',
      '4809990000002',
      '4809990000003'
    ))
    OR (ii.item_code = 'INV-START-FOOD-003')
    OR (ii.item_code = 'INV-START-FOOD-004')
    OR (ii.item_code = 'INV-START-HYG-001')
  RETURNING id, inventory_item_id, batch_no, quantity_received
)
INSERT INTO inventory_transactions (
  disaster_event_id,
  inventory_batch_id,
  transaction_type,
  quantity,
  reference_type,
  reference_id,
  performed_by,
  performed_at,
  remarks
)
SELECT
  NULL AS disaster_event_id,
  ib.id AS inventory_batch_id,
  'INFLOW' AS transaction_type,
  ib.quantity_received AS quantity,
  'SYSTEM' AS reference_type,
  ib.inventory_item_id AS reference_id,
  (SELECT id FROM mayor_user) AS performed_by,
  NOW() AS performed_at,
  CASE
    WHEN ib.batch_no LIKE '%OPEN%' THEN 'Opening stock seeded for clean inventory baseline'
    ELSE 'Restock batch seeded for clean inventory baseline'
  END AS remarks
FROM inserted_batches ib
;

COMMIT;
