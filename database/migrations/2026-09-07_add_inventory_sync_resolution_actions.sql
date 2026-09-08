BEGIN;

-- Allow Mayor Conflict Review to accept both distinct inventory batch entries.
ALTER TABLE public.sync_conflicts
DROP CONSTRAINT IF EXISTS sync_conflicts_resolution_action_check;

ALTER TABLE public.sync_conflicts
ADD CONSTRAINT sync_conflicts_resolution_action_check
CHECK (
    resolution_action IS NULL
    OR resolution_action IN (
        'MARK_REVIEWED',
        'KEEP_SERVER',
        'APPLY_LOCAL',
        'ACCEPT_BOTH'
    )
);

COMMIT;
