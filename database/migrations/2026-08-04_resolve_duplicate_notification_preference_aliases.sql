CREATE OR REPLACE FUNCTION public._merge_notification_channel(
  preferences jsonb,
  rule_codes text[],
  channel_key text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM unnest(rule_codes) AS rule_code
      WHERE preferences ? rule_code
        AND (preferences -> rule_code) ? channel_key
        AND (preferences -> rule_code ->> channel_key)::boolean = TRUE
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM unnest(rule_codes) AS rule_code
      WHERE preferences ? rule_code
        AND (preferences -> rule_code) ? channel_key
        AND (preferences -> rule_code ->> channel_key)::boolean = FALSE
    ) THEN FALSE
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public._upsert_notification_preference_entry(
  base_preferences jsonb,
  canonical_rule_code text,
  rule_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  next_preferences jsonb := COALESCE(base_preferences, '{}'::jsonb);
  next_in_app boolean;
  next_email boolean;
  next_rule_value jsonb := '{}'::jsonb;
BEGIN
  next_in_app := public._merge_notification_channel(
    next_preferences,
    rule_codes,
    'inApp'
  );
  next_email := public._merge_notification_channel(
    next_preferences,
    rule_codes,
    'email'
  );

  IF next_in_app IS NOT NULL THEN
    next_rule_value := jsonb_set(next_rule_value, '{inApp}', to_jsonb(next_in_app), TRUE);
  END IF;

  IF next_email IS NOT NULL THEN
    next_rule_value := jsonb_set(next_rule_value, '{email}', to_jsonb(next_email), TRUE);
  END IF;

  next_preferences := next_preferences - rule_codes;

  IF next_rule_value <> '{}'::jsonb THEN
    next_preferences := jsonb_set(
      next_preferences,
      ARRAY[canonical_rule_code],
      next_rule_value,
      TRUE
    );
  END IF;

  RETURN next_preferences;
END;
$$;

UPDATE public.user_role_settings
SET notification_rule_preferences_json = canonical_preferences.next_preferences,
    updated_at = NOW(),
    last_preference_save_at = COALESCE(last_preference_save_at, NOW())
FROM (
  SELECT
    user_id,
    role_code,
    public._upsert_notification_preference_entry(
      public._upsert_notification_preference_entry(
        public._upsert_notification_preference_entry(
          public._upsert_notification_preference_entry(
            public._upsert_notification_preference_entry(
              public._upsert_notification_preference_entry(
                public._upsert_notification_preference_entry(
                  public._upsert_notification_preference_entry(
                    COALESCE(notification_rule_preferences_json, '{}'::jsonb),
                    'DISASTER_EVENT_UPDATED',
                    ARRAY['DISASTER_EVENT_UPDATE', 'DISASTER_EVENT_UPDATED']
                  ),
                  'EVACUEE_ATTENDANCE_UPDATED',
                  ARRAY['EVACUEE_ATTENDANCE_UPDATE', 'EVACUEE_ATTENDANCE_UPDATED']
                ),
                'HOUSEHOLD_VERIFICATION_UPDATED',
                ARRAY[
                  'HOUSEHOLD_VERIFICATION',
                  'HOUSEHOLD_VERIFICATION_UPDATE',
                  'HOUSEHOLD_VERIFICATION_UPDATED'
                ]
              ),
              'DISTRIBUTION_COMPLETED',
              ARRAY['DISTRIBUTION_UPDATE', 'DISTRIBUTION_COMPLETED']
            ),
            'CRITICAL_INVENTORY_SHORTAGE',
            ARRAY['LOW_STOCK', 'CRITICAL_STOCK', 'CRITICAL_INVENTORY_SHORTAGE']
          ),
          'DONATION_RECEIVED',
          ARRAY['DONATION_STOCK_UPDATE', 'DONATION_RECEIVED']
        ),
        'OPERATIONAL_ANOMALY',
        ARRAY[
          'INVENTORY_INCIDENT',
          'SYSTEM_ANOMALY',
          'DONATION_STOCK_ANOMALY',
          'OPERATIONAL_ANOMALY'
        ]
      ),
      'SYNC_FAILURE',
      ARRAY[
        'SYNC_CONFLICT',
        'SYNCHRONIZATION_CONFLICT_ALERT',
        'SYNC_FAILURE'
      ]
    ) AS next_preferences
  FROM public.user_role_settings
) AS canonical_preferences
WHERE user_role_settings.user_id = canonical_preferences.user_id
  AND user_role_settings.role_code = canonical_preferences.role_code;

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
  ('EVACUATION_SUMMARY_REPORT', 'Evacuation Summary Reports', 'EVACUATION_SUMMARY_REPORT', 'MAYOR', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = EXCLUDED.is_active;

UPDATE public.notification_rules
SET is_active = FALSE
WHERE code IN (
  'DISASTER_EVENT_UPDATE',
  'EVACUEE_ATTENDANCE_UPDATE',
  'HOUSEHOLD_VERIFICATION',
  'HOUSEHOLD_VERIFICATION_UPDATE',
  'DISTRIBUTION_UPDATE',
  'LOW_STOCK',
  'CRITICAL_STOCK',
  'DONATION_STOCK_UPDATE',
  'INVENTORY_INCIDENT',
  'DONATION_STOCK_ANOMALY',
  'SYNC_CONFLICT',
  'SYNCHRONIZATION_CONFLICT_ALERT',
  'SYSTEM_ANOMALY'
);

UPDATE public.notification_rule_role_policies
SET is_active = FALSE,
    updated_at = NOW()
WHERE rule_code IN (
  'DISASTER_EVENT_UPDATE',
  'EVACUEE_ATTENDANCE_UPDATE',
  'HOUSEHOLD_VERIFICATION',
  'HOUSEHOLD_VERIFICATION_UPDATE',
  'DISTRIBUTION_UPDATE',
  'LOW_STOCK',
  'CRITICAL_STOCK',
  'DONATION_STOCK_UPDATE',
  'INVENTORY_INCIDENT',
  'DONATION_STOCK_ANOMALY',
  'SYNC_CONFLICT',
  'SYNCHRONIZATION_CONFLICT_ALERT',
  'SYSTEM_ANOMALY',
  'SYSTEM_ALERT'
);

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
  ('SYSTEM_ALERT', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW())
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

DROP FUNCTION IF EXISTS public._upsert_notification_preference_entry(jsonb, text, text[]);
DROP FUNCTION IF EXISTS public._merge_notification_channel(jsonb, text[], text);
