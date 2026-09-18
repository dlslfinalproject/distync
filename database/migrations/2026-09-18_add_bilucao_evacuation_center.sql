BEGIN;

INSERT INTO public.evacuation_centers (barangay_id, name)
SELECT b.id, 'Bilucao Evacuation Center'
FROM public.barangays b
WHERE b.code = 'BILUCAO'
  AND NOT EXISTS (
    SELECT 1
    FROM public.evacuation_centers ec
    WHERE ec.barangay_id = b.id
      AND ec.name = 'Bilucao Evacuation Center'
  );

COMMIT;
