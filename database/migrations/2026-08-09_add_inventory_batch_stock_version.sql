ALTER TABLE public.inventory_batches
ADD COLUMN IF NOT EXISTS stock_version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_inventory_batch_stock_version()
RETURNS trigger AS $$
BEGIN
  IF
    NEW.quantity_available IS DISTINCT FROM OLD.quantity_available
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.expiration_date IS DISTINCT FROM OLD.expiration_date
  THEN
    NEW.stock_version := OLD.stock_version + 1;
  ELSE
    NEW.stock_version := OLD.stock_version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_batches_stock_version_before_update
ON public.inventory_batches;

CREATE TRIGGER inventory_batches_stock_version_before_update
BEFORE UPDATE
ON public.inventory_batches
FOR EACH ROW
EXECUTE FUNCTION public.increment_inventory_batch_stock_version();
