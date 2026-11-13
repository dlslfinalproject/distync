BEGIN;

ALTER TABLE public.distribution_transaction_relief_pack_templates
  ADD COLUMN IF NOT EXISTS name_snapshot text;

ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS item_code_snapshot text;

ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS item_name_snapshot text;

ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS unit_of_measure_snapshot text;

UPDATE public.distribution_transaction_relief_pack_templates dtrpt
SET name_snapshot = rpt.name
FROM public.relief_pack_templates rpt
WHERE rpt.id = dtrpt.relief_pack_template_id
  AND dtrpt.name_snapshot IS NULL;

UPDATE public.distribution_transaction_items dti
SET
  item_code_snapshot = ii.item_code,
  item_name_snapshot = ii.item_name,
  unit_of_measure_snapshot = ii.unit_of_measure
FROM public.inventory_items ii
WHERE ii.id = dti.inventory_item_id
  AND (
    dti.item_code_snapshot IS NULL
    OR dti.item_name_snapshot IS NULL
    OR dti.unit_of_measure_snapshot IS NULL
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.distribution_transaction_relief_pack_templates
    WHERE name_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce relief-pack template name snapshots while existing linked transactions are missing names.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.distribution_transaction_items
    WHERE item_code_snapshot IS NULL
       OR item_name_snapshot IS NULL
       OR unit_of_measure_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce distribution item snapshots while existing transaction items are missing inventory labels.';
  END IF;
END;
$$;

ALTER TABLE public.distribution_transaction_relief_pack_templates
  ALTER COLUMN name_snapshot SET NOT NULL;

ALTER TABLE public.distribution_transaction_items
  ALTER COLUMN item_code_snapshot SET NOT NULL,
  ALTER COLUMN item_name_snapshot SET NOT NULL,
  ALTER COLUMN unit_of_measure_snapshot SET NOT NULL;

COMMIT;
