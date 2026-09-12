BEGIN;

ALTER TABLE public.inventory_item_stock_forms
  ADD CONSTRAINT uq_inventory_item_stock_forms_id_item
  UNIQUE (id, inventory_item_id);

ALTER TABLE public.inventory_batches
  ADD CONSTRAINT inventory_batches_stock_form_item_same_fkey
  FOREIGN KEY (inventory_item_stock_form_id, inventory_item_id)
  REFERENCES public.inventory_item_stock_forms (id, inventory_item_id)
  MATCH SIMPLE
  ON UPDATE NO ACTION
  ON DELETE NO ACTION
  NOT VALID;

ALTER TABLE public.inventory_batches
  VALIDATE CONSTRAINT inventory_batches_stock_form_item_same_fkey;

COMMIT;
