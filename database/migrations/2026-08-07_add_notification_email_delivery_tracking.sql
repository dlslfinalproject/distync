BEGIN;

CREATE TABLE public.notification_email_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id),
  role_code text NOT NULL REFERENCES public.roles(code),
  status text NOT NULL CHECK (status IN ('SENDING', 'SENT', 'RETRY_PENDING', 'FAILED', 'SKIPPED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamp with time zone,
  next_retry_at timestamp with time zone,
  provider_message_id text,
  last_error_code text,
  last_error_message_sanitized text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_email_deliveries_unique_delivery
    UNIQUE (notification_id, recipient_user_id)
);

CREATE INDEX idx_notification_email_deliveries_retry_due
  ON public.notification_email_deliveries(next_retry_at)
  WHERE status = 'RETRY_PENDING';

CREATE INDEX idx_notification_email_deliveries_sending_stale
  ON public.notification_email_deliveries(last_attempt_at)
  WHERE status = 'SENDING';

COMMIT;
