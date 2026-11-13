CREATE TABLE IF NOT EXISTS public.anomaly_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_type character varying NOT NULL,
  source_id text NOT NULL,
  anomaly_type character varying NOT NULL,
  barangay_id uuid NOT NULL,
  disaster_event_id uuid,
  review_status character varying NOT NULL,
  resolution_reason text NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT anomaly_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT anomaly_reviews_barangay_id_fkey FOREIGN KEY (barangay_id) REFERENCES public.barangays(id),
  CONSTRAINT anomaly_reviews_disaster_event_id_fkey FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT anomaly_reviews_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id),
  CONSTRAINT anomaly_reviews_review_status_check CHECK (
    review_status::text = ANY (
      ARRAY[
        'REVIEWED_VALID'::character varying,
        'ISSUE_CONFIRMED'::character varying,
        'REFERRED'::character varying
      ]::text[]
    )
  ),
  CONSTRAINT anomaly_reviews_resolution_reason_check CHECK (
    length(btrim(resolution_reason)) BETWEEN 1 AND 2000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS anomaly_reviews_current_identity_unique
  ON public.anomaly_reviews (
    source_type,
    source_id,
    anomaly_type,
    barangay_id
  );

CREATE INDEX IF NOT EXISTS anomaly_reviews_barangay_status_idx
  ON public.anomaly_reviews (barangay_id, review_status, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS anomaly_reviews_disaster_event_idx
  ON public.anomaly_reviews (disaster_event_id)
  WHERE disaster_event_id IS NOT NULL;
