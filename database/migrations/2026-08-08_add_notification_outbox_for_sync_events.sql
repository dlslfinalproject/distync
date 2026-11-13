ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_event_key_unique
  ON public.notifications(source_event_key)
  WHERE source_event_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('SYNC_FAILURE', 'SYNC_CONFLICT')),
  source_type text NOT NULL CHECK (source_type IN ('SYNC_TRANSACTION', 'SYNC_CONFLICT')),
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_outbox_pkey PRIMARY KEY (id),
  CONSTRAINT notification_outbox_source_unique UNIQUE (event_type, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox(status, created_at)
  WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');
