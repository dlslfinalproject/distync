BEGIN;

CREATE TABLE IF NOT EXISTS public.distribution_transaction_relief_pack_templates (
  distribution_transaction_id uuid NOT NULL,
  relief_pack_template_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT distribution_transaction_relief_pack_templates_pkey
    PRIMARY KEY (distribution_transaction_id, relief_pack_template_id),
  CONSTRAINT distribution_transaction_relief_pack_templates_transaction_id_fkey
    FOREIGN KEY (distribution_transaction_id)
    REFERENCES public.distribution_transactions(id)
    ON DELETE CASCADE,
  CONSTRAINT distribution_transaction_relief_pack_templates_template_id_fkey
    FOREIGN KEY (relief_pack_template_id)
    REFERENCES public.relief_pack_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_distribution_transaction_relief_pack_templates_template_id
  ON public.distribution_transaction_relief_pack_templates (relief_pack_template_id);

-- Preserve the existing singular linkage for historical distributions. New
-- automatic claims add all assigned templates through the application service.
INSERT INTO public.distribution_transaction_relief_pack_templates (
  distribution_transaction_id,
  relief_pack_template_id
)
SELECT
  dt.id,
  dt.relief_pack_template_id
FROM public.distribution_transactions dt
WHERE dt.relief_pack_template_id IS NOT NULL
ON CONFLICT (distribution_transaction_id, relief_pack_template_id) DO NOTHING;

COMMIT;
