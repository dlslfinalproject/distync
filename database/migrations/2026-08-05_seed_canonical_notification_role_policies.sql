BEGIN;

WITH canonical_rules AS (
  SELECT *
  FROM (
    VALUES
      ('DISASTER_EVENT_CREATED', 'Newly Created Disaster Event', 'DISASTER_EVENT_CREATED', 'MSWDO', TRUE),
      ('DISASTER_EVENT_UPDATED', 'Disaster Event Updates', 'DISASTER_EVENT_UPDATED', 'MSWDO', TRUE),
      ('HOUSEHOLD_REGISTERED', 'New Evacuee Registration', 'HOUSEHOLD_REGISTRATION', 'BARANGAY', TRUE),
      ('EVACUEE_ATTENDANCE_UPDATED', 'Evacuee Attendance Updates', 'EVACUEE_ATTENDANCE_UPDATED', 'BARANGAY', TRUE),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'Household Verification Updates', 'HOUSEHOLD_VERIFICATION_UPDATED', 'BARANGAY', TRUE),
      ('DISTRIBUTION_COMPLETED', 'Distribution Completed', 'DISTRIBUTION_COMPLETED', 'MSWDO', TRUE),
      ('LOW_STOCK', 'Low Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
      ('CRITICAL_INVENTORY_SHORTAGE', 'Critical Inventory Shortage', 'CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', TRUE),
      ('NEAR_EXPIRY_STOCK', 'Near Expiry Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
      ('EXPIRED_STOCK', 'Expired Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
      ('INVENTORY_INCIDENT', 'Inventory Incident Alert', 'INVENTORY_INCIDENT', 'MAYOR', TRUE),
      ('DONATION_RECEIVED', 'Donation Received', 'DONATION_RECEIVED', 'MAYOR', TRUE),
      ('SYNC_FAILURE', 'Sync Failure', 'SYNC_FAILURE', 'BARANGAY', TRUE),
      ('SYNC_CONFLICT', 'Synchronization Conflict Alert', 'SYNC_CONFLICT', 'BARANGAY', TRUE),
      ('DONATION_STOCK_ANOMALY', 'Donation Anomaly', 'DONATION_ANOMALY', 'MAYOR', TRUE),
      ('EVACUATION_SUMMARY_REPORT', 'Evacuation Summary Reports', 'EVACUATION_SUMMARY_REPORT', 'MAYOR', TRUE),
      ('SYSTEM_ALERT', 'System Alerts', 'SYSTEM_ALERT', 'BARANGAY', TRUE),
      ('SYSTEM_ANOMALY', 'System Anomaly Alert', 'SYSTEM_ANOMALY', 'BARANGAY', FALSE),
      ('OPERATIONAL_ANOMALY', 'Operational Anomaly Alerts', 'OPERATIONAL_ANOMALY', 'MAYOR', TRUE)
  ) AS rows(code, name, trigger_type, target_role_code, is_active)
)
INSERT INTO public.notification_rules (
  code,
  name,
  trigger_type,
  target_role_code,
  is_active,
  created_at
)
SELECT
  code,
  name,
  trigger_type,
  target_role_code,
  is_active,
  NOW()
FROM canonical_rules
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = EXCLUDED.is_active
WHERE
  public.notification_rules.name IS DISTINCT FROM EXCLUDED.name
  OR public.notification_rules.trigger_type IS DISTINCT FROM EXCLUDED.trigger_type
  OR public.notification_rules.target_role_code IS DISTINCT FROM EXCLUDED.target_role_code
  OR public.notification_rules.is_active IS DISTINCT FROM EXCLUDED.is_active;

WITH canonical_policies AS (
  SELECT *
  FROM (
    VALUES
      ('DISASTER_EVENT_CREATED', 'MSWDO', 'DISASTER_MANAGEMENT', 'Disaster Management', 'WARNING', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DISASTER_EVENT_UPDATED', 'BARANGAY', 'DISASTER_COORDINATION', 'Disaster Coordination', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DISASTER_EVENT_UPDATED', 'MSWDO', 'DISASTER_MANAGEMENT', 'Disaster Management', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DISASTER_EVENT_UPDATED', 'MAYOR', 'DISASTER_MONITORING', 'Disaster Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('HOUSEHOLD_REGISTERED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'UNAVAILABLE', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('HOUSEHOLD_REGISTERED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('EVACUEE_ATTENDANCE_UPDATED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'UNAVAILABLE', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('EVACUEE_ATTENDANCE_UPDATED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'WARNING', 'MANDATORY', 'OPTIONAL', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'WARNING', 'MANDATORY', 'OPTIONAL', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DISTRIBUTION_COMPLETED', 'MSWDO', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('DISTRIBUTION_COMPLETED', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('LOW_STOCK', 'MAYOR', 'INVENTORY_MONITORING', 'Inventory Monitoring', 'WARNING', 'MANDATORY', 'OPTIONAL', 'THRESHOLD', 'EMAIL_ONLY', TRUE),
      ('CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', 'INVENTORY_MONITORING', 'Inventory Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'THRESHOLD', 'EMAIL_ONLY', TRUE),
      ('NEAR_EXPIRY_STOCK', 'MAYOR', 'INVENTORY_MONITORING', 'Inventory Monitoring', 'WARNING', 'MANDATORY', 'OPTIONAL', 'THRESHOLD', 'EMAIL_ONLY', TRUE),
      ('EXPIRED_STOCK', 'MAYOR', 'INVENTORY_MONITORING', 'Inventory Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('INVENTORY_INCIDENT', 'MAYOR', 'INVENTORY_MONITORING', 'Inventory Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DONATION_RECEIVED', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'IMMEDIATE', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('SYNC_FAILURE', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYNC_FAILURE', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYNC_FAILURE', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYNC_CONFLICT', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYNC_CONFLICT', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYNC_CONFLICT', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('DONATION_STOCK_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('EVACUATION_SUMMARY_REPORT', 'MAYOR', 'DISASTER_MONITORING', 'Disaster Monitoring', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE),
      ('SYSTEM_ALERT', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYSTEM_ALERT', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYSTEM_ALERT', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE),
      ('SYSTEM_ANOMALY', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE),
      ('SYSTEM_ANOMALY', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE),
      ('SYSTEM_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE),
      ('OPERATIONAL_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE)
  ) AS rows(
    rule_code,
    role_code,
    category_code,
    category_label,
    priority,
    in_app_policy,
    email_policy,
    delivery_mode,
    user_configurability,
    is_active
  )
)
INSERT INTO public.notification_rule_role_policies (
  rule_code,
  role_code,
  category_code,
  category_label,
  priority,
  in_app_policy,
  email_policy,
  delivery_mode,
  user_configurability,
  is_active,
  created_at,
  updated_at
)
SELECT
  rule_code,
  role_code,
  category_code,
  category_label,
  priority,
  in_app_policy,
  email_policy,
  delivery_mode,
  user_configurability,
  is_active,
  NOW(),
  NOW()
FROM canonical_policies
ON CONFLICT (rule_code, role_code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_label = EXCLUDED.category_label,
  priority = EXCLUDED.priority,
  in_app_policy = EXCLUDED.in_app_policy,
  email_policy = EXCLUDED.email_policy,
  delivery_mode = EXCLUDED.delivery_mode,
  user_configurability = EXCLUDED.user_configurability,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
WHERE
  public.notification_rule_role_policies.category_code IS DISTINCT FROM EXCLUDED.category_code
  OR public.notification_rule_role_policies.category_label IS DISTINCT FROM EXCLUDED.category_label
  OR public.notification_rule_role_policies.priority IS DISTINCT FROM EXCLUDED.priority
  OR public.notification_rule_role_policies.in_app_policy IS DISTINCT FROM EXCLUDED.in_app_policy
  OR public.notification_rule_role_policies.email_policy IS DISTINCT FROM EXCLUDED.email_policy
  OR public.notification_rule_role_policies.delivery_mode IS DISTINCT FROM EXCLUDED.delivery_mode
  OR public.notification_rule_role_policies.user_configurability IS DISTINCT FROM EXCLUDED.user_configurability
  OR public.notification_rule_role_policies.is_active IS DISTINCT FROM EXCLUDED.is_active;

COMMIT;
