BEGIN;

ALTER TABLE public.inventory_batches
  DROP CONSTRAINT uq_inventory_batch;

COMMIT;
