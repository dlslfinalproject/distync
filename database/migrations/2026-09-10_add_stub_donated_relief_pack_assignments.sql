BEGIN;

-- Donated relief packs are assigned to an event-wide FIFO stub queue before
-- the household claims them.  The reservation is separate from inventory
-- OUTFLOW: stock is consumed only when the claim is confirmed.
CREATE TABLE IF NOT EXISTS public.stub_donated_relief_pack_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stub_id uuid NOT NULL,
  disaster_event_id uuid NOT NULL,
  donation_id uuid NOT NULL,
  pack_name text NOT NULL,
  pack_size integer NOT NULL CHECK (pack_size > 0),
  assignment_status character varying(20) NOT NULL DEFAULT 'RESERVED'::character varying
    CHECK (assignment_status::text = ANY (
      ARRAY[
        'RESERVED'::character varying,
        'CLAIMED'::character varying,
        'RELEASED'::character varying
      ]::text[]
    )),
  items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  claimed_at timestamp with time zone,
  released_at timestamp with time zone,
  release_reason text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stub_donated_relief_pack_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT stub_donated_relief_pack_assignments_stub_id_fkey
    FOREIGN KEY (stub_id) REFERENCES public.stubs(id) ON DELETE CASCADE,
  CONSTRAINT stub_donated_relief_pack_assignments_event_id_fkey
    FOREIGN KEY (disaster_event_id) REFERENCES public.disaster_events(id),
  CONSTRAINT stub_donated_relief_pack_assignments_donation_id_fkey
    FOREIGN KEY (donation_id) REFERENCES public.donations(id),
  CONSTRAINT stub_donated_relief_pack_assignments_items_array_check
    CHECK (jsonb_typeof(items_snapshot) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS stub_donated_relief_pack_assignments_group_unique
  ON public.stub_donated_relief_pack_assignments (
    stub_id,
    donation_id,
    LOWER(pack_name),
    pack_size
  );

CREATE INDEX IF NOT EXISTS stub_donated_relief_pack_assignments_event_status_idx
  ON public.stub_donated_relief_pack_assignments (disaster_event_id, assignment_status);

CREATE INDEX IF NOT EXISTS stub_donated_relief_pack_assignments_stub_status_idx
  ON public.stub_donated_relief_pack_assignments (stub_id, assignment_status);

COMMIT;
  