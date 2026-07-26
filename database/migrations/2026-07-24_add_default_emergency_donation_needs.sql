CREATE TABLE IF NOT EXISTS public.default_emergency_donation_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inventory_item_id uuid,
  item_name character varying NOT NULL,
  category character varying,
  unit_of_measure character varying NOT NULL DEFAULT 'items',
  suggested_quantity integer CHECK (suggested_quantity IS NULL OR suggested_quantity >= 0),
  priority_level character varying NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority_level::text = ANY (ARRAY[
      'LOW'::character varying,
      'MEDIUM'::character varying,
      'HIGH'::character varying,
      'URGENT'::character varying
    ]::text[])),
  notes text,
  disaster_type character varying,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT default_emergency_donation_needs_pkey PRIMARY KEY (id),
  CONSTRAINT default_emergency_donation_needs_inventory_item_id_fkey
    FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id)
);

CREATE INDEX IF NOT EXISTS idx_default_emergency_donation_needs_active
  ON public.default_emergency_donation_needs (is_active, disaster_type, display_order);

INSERT INTO public.default_emergency_donation_needs (
  item_name,
  category,
  unit_of_measure,
  suggested_quantity,
  priority_level,
  notes,
  display_order
)
SELECT
  seed.item_name,
  seed.category,
  seed.unit_of_measure,
  seed.suggested_quantity::integer,
  seed.priority_level,
  seed.notes,
  seed.display_order::integer
FROM (
  VALUES
  ('Rice', 'Food', 'kg', NULL, 'HIGH', 'Staple food item for immediate relief support.', 10),
  ('Bottled Water', 'Water', 'bottles', NULL, 'HIGH', 'Safe drinking water for affected families and responders.', 20),
  ('Canned Goods', 'Food', 'cans', NULL, 'HIGH', 'Ready-to-distribute food while meal operations are still being organized.', 30),
  ('Ready-to-eat Food', 'Food', 'packs', NULL, 'HIGH', 'Quick food support for initial response and mobile operations.', 40),
  ('Hygiene Kits', 'Hygiene', 'packs', NULL, 'MEDIUM', 'Basic sanitation supplies for affected families.', 50),
  ('Blankets', 'Shelter', 'pieces', NULL, 'MEDIUM', 'Warmth and temporary shelter support for evacuees.', 60),
  ('Medicines', 'Medical', 'packs', NULL, 'MEDIUM', 'Basic over-the-counter and first-aid supplies coordinated through official channels.', 70),
  ('Baby Supplies', 'Family Support', 'packs', NULL, 'MEDIUM', 'Diapers, baby food, and infant care essentials.', 80),
  ('Clothing', 'Family Support', 'pieces', NULL, 'LOW', 'Clean clothing support when requested by receiving teams.', 90),
  ('Flashlights and Batteries', 'Emergency Supplies', 'sets', NULL, 'LOW', 'Basic emergency supplies for outages and field response.', 100)
) AS seed (
  item_name,
  category,
  unit_of_measure,
  suggested_quantity,
  priority_level,
  notes,
  display_order
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.default_emergency_donation_needs existing
  WHERE LOWER(existing.item_name) = LOWER(seed.item_name)
    AND existing.disaster_type IS NULL
);

UPDATE public.default_emergency_donation_needs defaults
SET inventory_item_id = inventory_items.id,
    unit_of_measure = COALESCE(inventory_items.unit_of_measure, defaults.unit_of_measure),
    category = COALESCE(inventory_items.category, defaults.category)
FROM public.inventory_items
WHERE defaults.inventory_item_id IS NULL
  AND LOWER(defaults.item_name) = LOWER(inventory_items.item_name);
