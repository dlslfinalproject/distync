ALTER TABLE public.relief_pack_templates
ADD COLUMN IF NOT EXISTS applies_to_all_disasters boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.relief_pack_template_disaster_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  disaster_type character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT relief_pack_template_disaster_types_pkey PRIMARY KEY (id),
  CONSTRAINT relief_pack_template_disaster_types_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.relief_pack_templates(id) ON DELETE CASCADE,
  CONSTRAINT relief_pack_template_disaster_types_unique UNIQUE (template_id, disaster_type)
);

CREATE INDEX IF NOT EXISTS idx_relief_pack_template_disaster_types_template_id
  ON public.relief_pack_template_disaster_types (template_id);
