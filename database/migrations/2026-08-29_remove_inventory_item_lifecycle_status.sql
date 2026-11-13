-- Inventory items are permanent catalog records.
-- Expiration, depletion, and write-offs are tracked by inventory batches and
-- inventory transactions, so the parent item does not need an active flag.

BEGIN;

ALTER TABLE public.inventory_items
  DROP COLUMN IF EXISTS is_active;

COMMIT;
