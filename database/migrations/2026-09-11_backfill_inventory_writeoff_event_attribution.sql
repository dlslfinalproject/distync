-- Backfill disaster-event attribution for legacy donated loose-item write-offs.
-- Relief-pack write-offs are intentionally excluded because those write-offs are
-- not an allowed inventory operation. Batches linked to multiple donation
-- events are skipped rather than assigned an arbitrary event.

BEGIN;

WITH unambiguous_donation_events AS (
  SELECT
    it.id AS inventory_transaction_id,
    MIN(d.disaster_event_id) AS disaster_event_id
  FROM public.inventory_transactions it
  INNER JOIN public.inventory_batches ib
    ON ib.id = it.inventory_batch_id
  INNER JOIN public.donation_items di
    ON di.inventory_batch_id = ib.id
  INNER JOIN public.donations d
    ON d.id = di.donation_id
  WHERE it.disaster_event_id IS NULL
    AND (it.reference_type IS NULL OR it.reference_type = 'MANUAL')
    AND it.transaction_type IN (
      'EXPIRED',
      'MISSING',
      'DAMAGED',
      'SPOILED',
      'STOLEN',
      'OTHER'
    )
    AND ib.source_type = 'DONATED'
    AND COALESCE(di.remarks, '') NOT ILIKE 'Relief Pack:%'
  GROUP BY it.id
  HAVING COUNT(DISTINCT d.disaster_event_id) = 1
)
UPDATE public.inventory_transactions it
SET disaster_event_id = donation_events.disaster_event_id
FROM unambiguous_donation_events donation_events
WHERE it.id = donation_events.inventory_transaction_id
  AND it.disaster_event_id IS NULL;

COMMIT;
