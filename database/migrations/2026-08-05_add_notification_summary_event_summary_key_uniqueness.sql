WITH ranked_summary_events AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY summary_key
      ORDER BY
        CASE WHEN processed_at IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS duplicate_rank
  FROM public.notification_summary_events
)
DELETE FROM public.notification_summary_events duplicate_rows
USING ranked_summary_events ranked
WHERE duplicate_rows.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_summary_events_summary_key_unique
  ON public.notification_summary_events(summary_key);
