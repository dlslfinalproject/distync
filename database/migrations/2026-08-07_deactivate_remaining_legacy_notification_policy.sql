BEGIN;

-- The canonical runtime catalog contains no active definitions for these
-- historical/legacy rules. Preserve rows and historical notifications, but
-- remove them from active delivery and Settings policy resolution.
WITH legacy_rule_codes(code) AS (
  VALUES
    ('CRITICAL_STOCK'),
    ('DISASTER_EVENT_UPDATE'),
    ('DISTRIBUTION_UPDATE'),
    ('DONATION_STOCK_UPDATE'),
    ('EVACUEE_ATTENDANCE_UPDATE'),
    ('HOUSEHOLD_VERIFICATION'),
    ('SYSTEM_ANOMALY')
)
UPDATE public.notification_rule_role_policies policies
SET
  is_active = FALSE,
  updated_at = NOW()
FROM legacy_rule_codes legacy
WHERE policies.rule_code = legacy.code
  AND policies.is_active IS DISTINCT FROM FALSE;

WITH legacy_rule_codes(code) AS (
  VALUES
    ('CRITICAL_STOCK'),
    ('DISASTER_EVENT_UPDATE'),
    ('DISTRIBUTION_UPDATE'),
    ('DONATION_STOCK_UPDATE'),
    ('EVACUEE_ATTENDANCE_UPDATE'),
    ('HOUSEHOLD_VERIFICATION'),
    ('SYSTEM_ANOMALY')
)
UPDATE public.notification_rules rules
SET is_active = FALSE
FROM legacy_rule_codes legacy
WHERE rules.code = legacy.code
  AND rules.is_active IS DISTINCT FROM FALSE;

COMMIT;
