CREATE TABLE IF NOT EXISTS inventory_item_stock_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    barcode VARCHAR(50) UNIQUE,
    packaging VARCHAR(50) NOT NULL,
    units_per_packaging INTEGER NOT NULL CHECK (units_per_packaging > 0),
    unit_of_measure VARCHAR(20) NOT NULL,
    unit_of_measure_value NUMERIC(12,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_inventory_item_stock_form_unit_of_measure_value
        CHECK (unit_of_measure_value IS NULL OR unit_of_measure_value > 0),
    CONSTRAINT inventory_item_stock_forms_unique_definition
        UNIQUE (
            inventory_item_id,
            packaging,
            units_per_packaging,
            unit_of_measure,
            unit_of_measure_value
        )
);

ALTER TABLE inventory_batches
ADD COLUMN IF NOT EXISTS inventory_item_stock_form_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'inventory_batches_inventory_item_stock_form_id_fkey'
    ) THEN
        ALTER TABLE inventory_batches
        ADD CONSTRAINT inventory_batches_inventory_item_stock_form_id_fkey
            FOREIGN KEY (inventory_item_stock_form_id)
            REFERENCES inventory_item_stock_forms(id);
    END IF;
END $$;

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
    NULLIF(TRIM(ii.barcode), ''),
    COALESCE(NULLIF(TRIM(ii.packaging), ''), 'piece'),
    COALESCE(ii.quantity, 1),
    ii.unit_of_measure,
    ii.unit_of_measure_value,
    TRUE
FROM inventory_items ii
WHERE NOT EXISTS (
    SELECT 1
    FROM inventory_item_stock_forms stock_forms
    WHERE stock_forms.inventory_item_id = ii.id
);

UPDATE inventory_batches ib
SET inventory_item_stock_form_id = stock_form_match.id
FROM (
    SELECT DISTINCT ON (stock_forms.inventory_item_id)
        stock_forms.inventory_item_id,
        stock_forms.id
    FROM inventory_item_stock_forms stock_forms
    ORDER BY stock_forms.inventory_item_id, stock_forms.created_at ASC
) AS stock_form_match
WHERE ib.inventory_item_stock_form_id IS NULL
  AND ib.inventory_item_id = stock_form_match.inventory_item_id;
