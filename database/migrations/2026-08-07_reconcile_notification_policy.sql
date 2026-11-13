BEGIN;

-- These generic rules have no producer. Specific sync and anomaly rules remain active.
UPDATE public.notification_rule_role_policies
SET is_active = FALSE, updated_at = NOW()
WHERE rule_code IN ('SYSTEM_ALERT', 'OPERATIONAL_ANOMALY')
  AND is_active IS DISTINCT FROM FALSE;

UPDATE public.notification_rules
SET is_active = FALSE
WHERE code IN ('SYSTEM_ALERT', 'OPERATIONAL_ANOMALY')
  AND is_active IS DISTINCT FROM FALSE;

-- DISTRIBUTION_UPDATE has no semantically equivalent current rule: the old
-- update lifecycle is not interchangeable with DISTRIBUTION_COMPLETED.
-- Keep the row for history, but prevent it from being delivered or configured.
UPDATE public.notification_rule_role_policies
SET is_active = FALSE, updated_at = NOW()
WHERE rule_code = 'DISTRIBUTION_UPDATE'
  AND is_active IS DISTINCT FROM FALSE;

UPDATE public.notification_rules
SET is_active = FALSE
WHERE code = 'DISTRIBUTION_UPDATE'
  AND is_active IS DISTINCT FROM FALSE;

COMMIT;
