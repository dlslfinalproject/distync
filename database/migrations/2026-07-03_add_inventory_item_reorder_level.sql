ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS reorder_level INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_inventory_item_reorder_level'
    ) THEN
        ALTER TABLE inventory_items
        ADD CONSTRAINT chk_inventory_item_reorder_level
            CHECK (reorder_level IS NULL OR reorder_level > 0);
    END IF;
END $$;
