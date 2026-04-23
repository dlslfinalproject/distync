ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS packaging VARCHAR(50);

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS quantity INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_inventory_item_quantity'
    ) THEN
        ALTER TABLE inventory_items
        ADD CONSTRAINT chk_inventory_item_quantity
            CHECK (quantity IS NULL OR quantity > 0);
    END IF;
END $$;
