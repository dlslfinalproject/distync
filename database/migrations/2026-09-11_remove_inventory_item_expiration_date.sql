BEGIN;

ALTER TABLE public.inventory_items
  DROP COLUMN expiration_date;

COMMIT;
