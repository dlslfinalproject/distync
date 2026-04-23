ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS packaging_count INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_inventory_item_packaging_count'
    ) THEN
        ALTER TABLE inventory_items
        ADD CONSTRAINT chk_inventory_item_packaging_count
            CHECK (packaging_count IS NULL OR packaging_count > 0);
    END IF;
END $$;
