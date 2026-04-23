BEGIN;

ALTER TABLE households
ADD COLUMN IF NOT EXISTS residency_status VARCHAR(30) NOT NULL DEFAULT 'RESIDENT';

WITH legacy_non_residents AS (
  SELECT
    h.id,
    ec.barangay_id AS handling_barangay_id
  FROM households h
  JOIN barangays b ON b.id = h.barangay_id
  LEFT JOIN evacuation_centers ec ON ec.id = h.evacuation_center_id
  WHERE b.code = 'NON_RESIDENT_OUTSIDE_MALVAR'
)
UPDATE households h
SET
  residency_status = 'NON_RESIDENT',
  barangay_id = lnr.handling_barangay_id,
  updated_at = NOW()
FROM legacy_non_residents lnr
WHERE h.id = lnr.id
  AND lnr.handling_barangay_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM households h
    JOIN barangays b ON b.id = h.barangay_id
    WHERE b.code = 'NON_RESIDENT_OUTSIDE_MALVAR'
  ) THEN
    RAISE EXCEPTION 'Cannot complete non-resident migration: assign legacy Outside Malvar households to a real handling barangay first.';
  END IF;
END $$;

UPDATE households
SET residency_status = 'RESIDENT'
WHERE residency_status IS NULL;

ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_household_residency_status;

ALTER TABLE households
ADD CONSTRAINT chk_household_residency_status
CHECK (residency_status IN ('RESIDENT', 'NON_RESIDENT'));

ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_household_residency_barangay;

ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_households_residency_barangay;

ALTER TABLE households
ALTER COLUMN barangay_id SET NOT NULL;

COMMIT;
