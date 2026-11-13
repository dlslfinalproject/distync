BEGIN;

-- Keep the specific relief-pack template that supplied each transaction item.
-- This is nullable for donated relief packs and donated loose items because
-- those allocations are not sourced from an LGU relief-pack template.
ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS relief_pack_template_id_snapshot uuid;

-- Backfill only unambiguous standard/additional item-to-template matches.
-- Ambiguous historical rows remain without a template snapshot so the UI does
-- not assign their quantity to the wrong pack.
WITH candidate_templates AS (
  SELECT DISTINCT
    dti.id AS item_id,
    dtrpt.relief_pack_template_id
  FROM public.distribution_transaction_items dti
  INNER JOIN public.distribution_transaction_relief_pack_templates dtrpt
    ON dtrpt.distribution_transaction_id = dti.distribution_transaction_id
  INNER JOIN public.relief_pack_template_items rpti
    ON rpti.template_id = dtrpt.relief_pack_template_id
   AND rpti.inventory_item_id = dti.inventory_item_id
  WHERE dti.relief_pack_template_id_snapshot IS NULL
    AND (
      (
        dti.relief_pack_type_snapshot = 'STANDARD_RELIEF_PACK'
        AND dtrpt.is_additional_pack_snapshot = false
      )
      OR (
        dti.relief_pack_type_snapshot = 'ADDITIONAL_RELIEF_PACK'
        AND dtrpt.is_additional_pack_snapshot = true
      )
    )
), unique_candidates AS (
  SELECT
    item_id,
    MIN(relief_pack_template_id::text)::uuid AS relief_pack_template_id
  FROM candidate_templates
  GROUP BY item_id
  HAVING COUNT(*) = 1
)
UPDATE public.distribution_transaction_items dti
SET relief_pack_template_id_snapshot = unique_candidates.relief_pack_template_id
FROM unique_candidates
WHERE dti.id = unique_candidates.item_id
  AND dti.relief_pack_template_id_snapshot IS NULL;

COMMIT;
