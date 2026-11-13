BEGIN;

-- Preserve the item classification and donation source that were used when a
-- distribution was claimed. Historical distribution details must not depend
-- on later inventory, batch, or donation edits.
ALTER TABLE public.distribution_transaction_items
  ADD COLUMN IF NOT EXISTS category_snapshot text,
  ADD COLUMN IF NOT EXISTS source_type_snapshot text,
  ADD COLUMN IF NOT EXISTS source_relief_type_snapshot text,
  ADD COLUMN IF NOT EXISTS donation_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS donation_item_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS donor_name_snapshot text,
  ADD COLUMN IF NOT EXISTS donated_relief_pack_name_snapshot text;

WITH current_source AS (
  SELECT
    dti.id AS item_id,
    ii.category,
    COALESCE(ib.source_type, 'LGU') AS source_type,
    CASE
      WHEN COALESCE(ib.source_type, 'LGU') = 'DONATED'
        AND COALESCE(source_donation.donation_item_remarks, '') ILIKE 'Relief Pack:%'
        THEN 'DONATED_RELIEF_PACK'
      WHEN COALESCE(ib.source_type, 'LGU') = 'DONATED'
        THEN 'DONATED_LOOSE_ITEM'
      ELSE COALESCE(ib.source_type, 'LGU')
    END AS source_relief_type,
    source_donation.donation_id,
    source_donation.donation_item_id,
    source_donation.donor_name,
    CASE
      WHEN COALESCE(source_donation.donation_item_remarks, '') ILIKE 'Relief Pack:%'
        THEN NULLIF(
          BTRIM(
            REGEXP_REPLACE(
              SPLIT_PART(
                REGEXP_REPLACE(
                  source_donation.donation_item_remarks,
                  '^Relief Pack:[[:space:]]*',
                  '',
                  1,
                  1,
                  'i'
                ),
                '.',
                1
              ),
              '[[:space:]]+x[[:space:]]+[0-9]+$',
              '',
              1,
              1,
              'i'
            )
          ),
          ''
        )
    END AS donated_relief_pack_name
  FROM public.distribution_transaction_items dti
  LEFT JOIN public.inventory_batches ib
    ON ib.id = dti.inventory_batch_id
  LEFT JOIN public.inventory_items ii
    ON ii.id = dti.inventory_item_id
  LEFT JOIN LATERAL (
    SELECT
      di.id AS donation_item_id,
      d.id AS donation_id,
      d.donor_name,
      di.remarks AS donation_item_remarks
    FROM public.donation_items di
    INNER JOIN public.donations d
      ON d.id = di.donation_id
    WHERE di.inventory_batch_id = dti.inventory_batch_id
      AND di.inventory_item_id = dti.inventory_item_id
    ORDER BY
      CASE
        WHEN COALESCE(di.remarks, '') ILIKE 'Relief Pack:%' THEN 0
        ELSE 1
      END,
      di.created_at ASC,
      di.id ASC
    LIMIT 1
  ) source_donation ON TRUE
)
UPDATE public.distribution_transaction_items dti
SET
  category_snapshot = current_source.category,
  source_type_snapshot = current_source.source_type,
  source_relief_type_snapshot = current_source.source_relief_type,
  donation_id_snapshot = current_source.donation_id,
  donation_item_id_snapshot = current_source.donation_item_id,
  donor_name_snapshot = current_source.donor_name,
  donated_relief_pack_name_snapshot = current_source.donated_relief_pack_name
FROM current_source
WHERE dti.id = current_source.item_id
  AND (
    dti.category_snapshot IS NULL
    OR dti.source_type_snapshot IS NULL
    OR dti.source_relief_type_snapshot IS NULL
    OR dti.donation_id_snapshot IS NULL
    OR dti.donation_item_id_snapshot IS NULL
    OR dti.donor_name_snapshot IS NULL
    OR dti.donated_relief_pack_name_snapshot IS NULL
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.distribution_transaction_items
    WHERE category_snapshot IS NULL
       OR source_type_snapshot IS NULL
       OR source_relief_type_snapshot IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce distribution source snapshots while existing transaction items are missing source data.';
  END IF;
END;
$$;

ALTER TABLE public.distribution_transaction_items
  ALTER COLUMN category_snapshot SET NOT NULL,
  ALTER COLUMN source_type_snapshot SET NOT NULL,
  ALTER COLUMN source_relief_type_snapshot SET NOT NULL;

COMMIT;
