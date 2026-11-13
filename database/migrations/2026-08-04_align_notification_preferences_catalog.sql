DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'EVENT',
      'INVENTORY',
      'EXPIRY',
      'SYNC',
      'ANOMALY',
      'SYSTEM',
      'SUMMARY'
    )
  );

WITH duplicate_rows AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY notification_id, user_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM public.notification_recipients
)
DELETE FROM public.notification_recipients nr
USING duplicate_rows duplicates
WHERE nr.id = duplicates.id
  AND duplicates.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_recipients_unique_delivery
  ON public.notification_recipients(notification_id, user_id);

INSERT INTO public.notification_rules (code, name, trigger_type, target_role_code, is_active)
VALUES
  ('DISASTER_EVENT_CREATED', 'Newly Created Disaster Event', 'DISASTER_EVENT_CREATED', 'MSWDO', TRUE),
  ('DISASTER_EVENT_UPDATED', 'Disaster Event Updates', 'DISASTER_EVENT_UPDATED', 'MSWDO', TRUE),
  ('HOUSEHOLD_REGISTERED', 'New Evacuee Registration', 'HOUSEHOLD_REGISTRATION', 'BARANGAY', TRUE),
  ('EVACUEE_ATTENDANCE_UPDATED', 'Evacuee Attendance Updates', 'EVACUEE_ATTENDANCE_UPDATED', 'BARANGAY', TRUE),
  ('HOUSEHOLD_VERIFICATION_UPDATED', 'Household Verification Updates', 'HOUSEHOLD_VERIFICATION_UPDATED', 'BARANGAY', TRUE),
  ('DISTRIBUTION_COMPLETED', 'Distribution Completed', 'DISTRIBUTION_COMPLETED', 'MSWDO', TRUE),
  ('CRITICAL_INVENTORY_SHORTAGE', 'Critical Inventory Shortage', 'CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', TRUE),
  ('DONATION_RECEIVED', 'Donation Received', 'DONATION_RECEIVED', 'MAYOR', TRUE),
  ('OPERATIONAL_ANOMALY', 'Operational Anomaly Alerts', 'OPERATIONAL_ANOMALY', 'MAYOR', TRUE),
  ('SYNC_FAILURE', 'Sync Failure', 'SYNC_FAILURE', 'BARANGAY', TRUE),
  ('SYSTEM_ALERT', 'System Alerts', 'SYSTEM_ALERT', 'BARANGAY', FALSE),
  ('EVACUATION_SUMMARY_REPORT', 'Evacuation Summary Reports', 'EVACUATION_SUMMARY_REPORT', 'MAYOR', TRUE),
  ('NEAR_EXPIRY_STOCK', 'Near Expiry Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('EXPIRED_STOCK', 'Expired Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = EXCLUDED.is_active;

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
VALUES
  ('DISASTER_EVENT_UPDATED', 'BARANGAY', 'DISASTER_COORDINATION', 'Disaster Coordination', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('HOUSEHOLD_REGISTERED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'UNAVAILABLE', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('EVACUEE_ATTENDANCE_UPDATED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'UNAVAILABLE', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('HOUSEHOLD_VERIFICATION_UPDATED', 'BARANGAY', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'WARNING', 'MANDATORY', 'OPTIONAL', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYNC_FAILURE', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYSTEM_ALERT', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('DISASTER_EVENT_CREATED', 'MSWDO', 'DISASTER_MANAGEMENT', 'Disaster Management', 'WARNING', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('DISASTER_EVENT_UPDATED', 'MSWDO', 'DISASTER_MANAGEMENT', 'Disaster Management', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('HOUSEHOLD_REGISTERED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('EVACUEE_ATTENDANCE_UPDATED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('HOUSEHOLD_VERIFICATION_UPDATED', 'MSWDO', 'EVACUEE_MANAGEMENT', 'Evacuee Management', 'WARNING', 'MANDATORY', 'OPTIONAL', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('DISTRIBUTION_COMPLETED', 'MSWDO', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('SYNC_FAILURE', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYSTEM_ALERT', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('DISASTER_EVENT_UPDATED', 'MAYOR', 'DISASTER_MONITORING', 'Disaster Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('EVACUATION_SUMMARY_REPORT', 'MAYOR', 'DISASTER_MONITORING', 'Disaster Monitoring', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'DAILY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'THRESHOLD', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('DISTRIBUTION_COMPLETED', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'HOURLY_SUMMARY', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('DONATION_RECEIVED', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'IMMEDIATE', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('OPERATIONAL_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYSTEM_ALERT', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('NEAR_EXPIRY_STOCK', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'WARNING', 'MANDATORY', 'OPTIONAL', 'THRESHOLD', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('EXPIRED_STOCK', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW())
ON CONFLICT (rule_code, role_code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_label = EXCLUDED.category_label,
  priority = EXCLUDED.priority,
  in_app_policy = EXCLUDED.in_app_policy,
  email_policy = EXCLUDED.email_policy,
  delivery_mode = EXCLUDED.delivery_mode,
  user_configurability = EXCLUDED.user_configurability,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
