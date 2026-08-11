BEGIN;

-- Supports recipient-scoped Notification Center listing and the join to
-- notifications. The existing unique index starts with notification_id, so it
-- cannot efficiently locate one user's deliveries.
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user_notification
  ON public.notification_recipients(user_id, notification_id);

-- Supports the unread badge and Mark All as Read lookup without indexing read
-- deliveries, which are not part of either query's predicate.
CREATE INDEX IF NOT EXISTS idx_notification_recipients_unread_user
  ON public.notification_recipients(user_id)
  WHERE read_at IS NULL;

COMMIT;
