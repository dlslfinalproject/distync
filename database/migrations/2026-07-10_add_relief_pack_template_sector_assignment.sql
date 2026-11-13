ALTER TABLE public.relief_pack_templates
ADD COLUMN IF NOT EXISTS is_additional_pack boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sector_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'relief_pack_templates_sector_id_fkey'
          AND table_name = 'relief_pack_templates'
    ) THEN
        ALTER TABLE public.relief_pack_templates
        ADD CONSTRAINT relief_pack_templates_sector_id_fkey
            FOREIGN KEY (sector_id) REFERENCES public.sectors(id);
    END IF;
END $$;
