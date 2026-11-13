-- Keep one packaging definition per inventory item.
-- A barcode identifies the packaging; it does not create a second definition.

ALTER TABLE inventory_item_stock_forms
DROP CONSTRAINT IF EXISTS inventory_item_stock_forms_unique_definition;

ALTER TABLE inventory_item_stock_forms
DROP CONSTRAINT IF EXISTS inventory_item_stock_forms_unique_packaging;

DROP INDEX IF EXISTS inventory_item_stock_forms_unique_definition;
DROP INDEX IF EXISTS inventory_item_stock_forms_unique_unbarcoded_definition;
DROP INDEX IF EXISTS inventory_item_stock_forms_unique_barcoded_definition;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_stock_forms_unique_definition
    ON inventory_item_stock_forms (
        inventory_item_id,
        packaging,
        units_per_packaging,
        unit_of_measure,
        COALESCE(unit_of_measure_value, '-1'::numeric)
    );
