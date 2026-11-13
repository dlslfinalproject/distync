BEGIN;

-- ============================================================
-- M-04: Manual sync conflict resolution metadata
-- ============================================================

ALTER TABLE public.sync_conflicts
ADD COLUMN IF NOT EXISTS resolution_action character varying,
ADD COLUMN IF NOT EXISTS resolution_reason text;


-- Keep human resolution action separate from resolution_strategy.
-- Historical/system-resolved conflicts may keep resolution_action NULL.
ALTER TABLE public.sync_conflicts
DROP CONSTRAINT IF EXISTS sync_conflicts_resolution_action_check;

ALTER TABLE public.sync_conflicts
ADD CONSTRAINT sync_conflicts_resolution_action_check
CHECK (
    resolution_action IS NULL
    OR resolution_action IN (
        'MARK_REVIEWED',
        'KEEP_SERVER',
        'APPLY_LOCAL'
    )
);


-- ============================================================
-- M-04: Durable conflict-resolution notification
-- ============================================================

ALTER TABLE public.notification_outbox
DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;

ALTER TABLE public.notification_outbox
ADD CONSTRAINT notification_outbox_event_type_check
CHECK (
    event_type IN (
        'SYNC_FAILURE',
        'SYNC_CONFLICT',
        'SYNC_CONFLICT_RESOLVED'
    )
);

COMMIT;