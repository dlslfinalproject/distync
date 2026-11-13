ALTER TABLE inventory_item_stock_forms
DROP CONSTRAINT IF EXISTS inventory_item_stock_forms_unique_definition;

ALTER TABLE inventory_item_stock_forms
DROP CONSTRAINT IF EXISTS inventory_item_stock_forms_unique_packaging;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_stock_forms_unique_unbarcoded_definition
    ON inventory_item_stock_forms (
        inventory_item_id,
        packaging,
        units_per_packaging,
        unit_of_measure,
        COALESCE(unit_of_measure_value, '-1'::numeric)
    )
    WHERE barcode IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_stock_forms_unique_barcoded_definition
    ON inventory_item_stock_forms (
        inventory_item_id,
        packaging,
        units_per_packaging,
        unit_of_measure,
        COALESCE(unit_of_measure_value, '-1'::numeric),
        barcode
    )
    WHERE barcode IS NOT NULL;
