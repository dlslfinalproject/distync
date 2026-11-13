ALTER TABLE public.donations
ADD COLUMN IF NOT EXISTS donor_type_other character varying;
