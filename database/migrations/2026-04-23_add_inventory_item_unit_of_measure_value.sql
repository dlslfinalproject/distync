ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS unit_of_measure_value NUMERIC(12,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_inventory_item_unit_of_measure_value'
    ) THEN
        ALTER TABLE inventory_items
        ADD CONSTRAINT chk_inventory_item_unit_of_measure_value
            CHECK (unit_of_measure_value IS NULL OR unit_of_measure_value > 0);
    END IF;
END $$;
