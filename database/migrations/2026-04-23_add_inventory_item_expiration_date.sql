ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS expiration_date DATE;
