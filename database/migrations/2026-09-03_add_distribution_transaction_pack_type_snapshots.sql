BEGIN;

ALTER TABLE public.distribution_transaction_relief_pack_templates
  ADD COLUMN IF NOT EXISTS is_additional_pack_snapshot boolean;

UPDATE public.distribution_transaction_relief_pack_templates dtrpt
SET is_additional_pack_snapshot = COALESCE(rpt.is_additional_pack, false)
FROM public.relief_pack_templates rpt
WHERE rpt.id = dtrpt.relief_pack_template_id
  AND dtrpt.is_additional_pack_snapshot IS NULL;

UPDATE public.distribution_transaction_relief_pack_templates
SET is_additional_pack_snapshot = false
WHERE is_additional_pack_snapshot IS NULL;

ALTER TABLE public.distribution_transaction_relief_pack_templates
  ALTER COLUMN is_additional_pack_snapshot SET DEFAULT false,
  ALTER COLUMN is_additional_pack_snapshot SET NOT NULL;

ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS relief_pack_type_snapshot text;

-- Prefer a donated relief-pack snapshot first. A donated loose item that was
-- used to satisfy a configured pack item is still classified by that pack's
-- standard/additional type below.
UPDATE public.distribution_transaction_items dti
SET relief_pack_type_snapshot = CASE
  WHEN EXISTS (
    SELECT 1
    FROM donation_items relief_pack_donation_item
    WHERE relief_pack_donation_item.inventory_batch_id = dti.inventory_batch_id
      AND relief_pack_donation_item.inventory_item_id = dti.inventory_item_id
      AND COALESCE(relief_pack_donation_item.remarks, '') ILIKE 'Relief Pack:%'
  ) THEN 'DONATED_RELIEF_PACK'
  WHEN EXISTS (
    SELECT 1
    FROM distribution_transaction_relief_pack_templates dtrpt_additional
    INNER JOIN relief_pack_template_items rpti_additional
      ON rpti_additional.template_id = dtrpt_additional.relief_pack_template_id
     AND rpti_additional.inventory_item_id = dti.inventory_item_id
    WHERE dtrpt_additional.distribution_transaction_id = dti.distribution_transaction_id
      AND dtrpt_additional.is_additional_pack_snapshot = true
  )
    AND NOT EXISTS (
      SELECT 1
      FROM distribution_transaction_relief_pack_templates dtrpt_standard
      INNER JOIN relief_pack_template_items rpti_standard
        ON rpti_standard.template_id = dtrpt_standard.relief_pack_template_id
       AND rpti_standard.inventory_item_id = dti.inventory_item_id
      WHERE dtrpt_standard.distribution_transaction_id = dti.distribution_transaction_id
        AND dtrpt_standard.is_additional_pack_snapshot = false
    ) THEN 'ADDITIONAL_RELIEF_PACK'
  WHEN EXISTS (
    SELECT 1
    FROM distribution_transaction_relief_pack_templates dtrpt_standard
    INNER JOIN relief_pack_template_items rpti_standard
      ON rpti_standard.template_id = dtrpt_standard.relief_pack_template_id
     AND rpti_standard.inventory_item_id = dti.inventory_item_id
      WHERE dtrpt_standard.distribution_transaction_id = dti.distribution_transaction_id
        AND dtrpt_standard.is_additional_pack_snapshot = false
    )
    AND NOT EXISTS (
      SELECT 1
      FROM distribution_transaction_relief_pack_templates dtrpt_additional_match
      INNER JOIN relief_pack_template_items rpti_additional_match
        ON rpti_additional_match.template_id = dtrpt_additional_match.relief_pack_template_id
       AND rpti_additional_match.inventory_item_id = dti.inventory_item_id
      WHERE dtrpt_additional_match.distribution_transaction_id = dti.distribution_transaction_id
        AND dtrpt_additional_match.is_additional_pack_snapshot = true
    ) THEN 'STANDARD_RELIEF_PACK'
  WHEN EXISTS (
    SELECT 1
    FROM distribution_transaction_relief_pack_templates dtrpt_additional_only
    WHERE dtrpt_additional_only.distribution_transaction_id = dti.distribution_transaction_id
      AND dtrpt_additional_only.is_additional_pack_snapshot = true
  )
    AND NOT EXISTS (
      SELECT 1
      FROM distribution_transaction_relief_pack_templates dtrpt_standard_only
      WHERE dtrpt_standard_only.distribution_transaction_id = dti.distribution_transaction_id
        AND dtrpt_standard_only.is_additional_pack_snapshot = false
    ) THEN 'ADDITIONAL_RELIEF_PACK'
  WHEN EXISTS (
    SELECT 1
    FROM distribution_transaction_relief_pack_templates dtrpt_both_additional
    WHERE dtrpt_both_additional.distribution_transaction_id = dti.distribution_transaction_id
      AND dtrpt_both_additional.is_additional_pack_snapshot = true
  )
    AND EXISTS (
      SELECT 1
      FROM distribution_transaction_relief_pack_templates dtrpt_both_standard
      WHERE dtrpt_both_standard.distribution_transaction_id = dti.distribution_transaction_id
        AND dtrpt_both_standard.is_additional_pack_snapshot = false
    ) THEN 'MIXED_RELIEF_PACK'
  WHEN EXISTS (
    SELECT 1
    FROM inventory_batches donated_batch
    WHERE donated_batch.id = dti.inventory_batch_id
      AND donated_batch.source_type = 'DONATED'
  ) THEN 'DONATED_LOOSE_ITEM'
  ELSE 'STANDARD_RELIEF_PACK'
END
WHERE dti.relief_pack_type_snapshot IS NULL;

ALTER TABLE public.distribution_transaction_items
  ALTER COLUMN relief_pack_type_snapshot SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'distribution_transaction_items_relief_pack_type_snapshot_check'
  ) THEN
    ALTER TABLE public.distribution_transaction_items
      ADD CONSTRAINT distribution_transaction_items_relief_pack_type_snapshot_check
      CHECK (
        relief_pack_type_snapshot IN (
          'STANDARD_RELIEF_PACK',
          'ADDITIONAL_RELIEF_PACK',
          'MIXED_RELIEF_PACK',
          'DONATED_RELIEF_PACK',
          'DONATED_LOOSE_ITEM'
        )
      );
  END IF;
END;
$$;

COMMIT;
