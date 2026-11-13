WITH item_totals AS (
  SELECT
    inventory_item_id,
    COALESCE(SUM(quantity_available), 0)::integer AS total_quantity_available
  FROM public.inventory_batches
  GROUP BY inventory_item_id
)
UPDATE public.inventory_batches ib
SET status = CASE
      WHEN COALESCE(ib.quantity_available, 0) <= 0 THEN 'DEPLETED'
      WHEN ib.expiration_date IS NOT NULL
        AND ib.expiration_date <= CURRENT_DATE THEN 'EXPIRED'
      WHEN COALESCE(totals.total_quantity_available, 0) > 0
        AND COALESCE(ii.reorder_level, 0) > 0
        AND totals.total_quantity_available <= ii.reorder_level
        THEN 'LOW_STOCK'
      ELSE 'AVAILABLE'
    END,
    updated_at = NOW()
FROM public.inventory_items ii
LEFT JOIN item_totals totals
  ON totals.inventory_item_id = ii.id
WHERE ib.inventory_item_id = ii.id
  AND ib.status IN ('AVAILABLE', 'LOW_STOCK', 'EXPIRED', 'DEPLETED');
