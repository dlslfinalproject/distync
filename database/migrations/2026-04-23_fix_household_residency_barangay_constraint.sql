BEGIN;

-- Non-resident is a residency classification. barangay_id is still the
-- operational handling barangay, so legacy NULL-barangay checks are invalid.
ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_household_residency_barangay;

ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_households_residency_barangay;

ALTER TABLE households
DROP CONSTRAINT IF EXISTS chk_household_residency_status;

ALTER TABLE households
ADD CONSTRAINT chk_household_residency_status
CHECK (residency_status IN ('RESIDENT', 'NON_RESIDENT'));

ALTER TABLE households
ALTER COLUMN barangay_id SET NOT NULL;

COMMIT;
