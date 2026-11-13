INSERT INTO notification_rules (code, name, trigger_type, target_role_code, is_active)
VALUES
  ('LOW_STOCK', 'Low Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
  ('CRITICAL_STOCK', 'Critical Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
  ('NEAR_EXPIRY_STOCK', 'Near Expiry Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('EXPIRED_STOCK', 'Expired Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('INVENTORY_INCIDENT', 'Inventory Incident Alert', 'INVENTORY_INCIDENT', 'MAYOR', TRUE),
  ('DONATION_STOCK_UPDATE', 'Donation Stock Update', 'DONATION_UPDATE', 'MAYOR', TRUE),
  ('DONATION_STOCK_ANOMALY', 'Donation Stock Anomaly', 'DONATION_ANOMALY', 'MAYOR', TRUE),
  ('DISASTER_EVENT_CREATED', 'Newly Created Disaster Event', 'DISASTER_EVENT_CREATED', 'MSWDO', TRUE),
  ('DISASTER_EVENT_UPDATE', 'Disaster Event Update', 'DISASTER_EVENT', 'MSWDO', TRUE),
  ('DISTRIBUTION_UPDATE', 'Distribution Update', 'DISTRIBUTION_UPDATE', 'MSWDO', TRUE),
  ('HOUSEHOLD_REGISTERED', 'Household Registration Update', 'HOUSEHOLD_REGISTRATION', 'BARANGAY', TRUE),
  ('HOUSEHOLD_VERIFICATION', 'Household Verification Update', 'HOUSEHOLD_VERIFICATION', 'BARANGAY', TRUE),
  ('EVACUEE_ATTENDANCE_UPDATE', 'Evacuee Attendance Update', 'EVACUEE_ATTENDANCE_UPDATE', 'BARANGAY', TRUE),
  ('SYNC_CONFLICT', 'Sync Conflict Alert', 'SYNC_CONFLICT', 'BARANGAY', TRUE),
  ('SYSTEM_ANOMALY', 'System Anomaly Alert', 'SYSTEM_ANOMALY', 'BARANGAY', TRUE),
  ('EVACUATION_SUMMARY_REPORT', 'Evacuation Monitoring Summary', 'EVACUATION_SUMMARY', 'MAYOR', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = EXCLUDED.is_active;

UPDATE user_role_settings
SET
  enabled_notification_rule_codes_json = (
    SELECT COALESCE(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    FROM (
      SELECT DISTINCT code
      FROM (
        SELECT jsonb_array_elements_text(
          COALESCE(user_role_settings.enabled_notification_rule_codes_json, '[]'::jsonb)
        ) AS code
        UNION ALL
        SELECT unnest(
          ARRAY[
            'DISASTER_EVENT_UPDATE',
            'HOUSEHOLD_REGISTERED',
            'HOUSEHOLD_VERIFICATION',
            'EVACUEE_ATTENDANCE_UPDATE',
            'SYNC_CONFLICT',
            'SYSTEM_ANOMALY'
          ]
        ) AS code
      ) merged_codes
    ) deduped_codes
  ),
  updated_at = NOW(),
  last_preference_save_at = NOW()
WHERE role_code = 'BARANGAY';

UPDATE user_role_settings
SET
  enabled_notification_rule_codes_json = (
    SELECT COALESCE(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    FROM (
      SELECT DISTINCT code
      FROM (
        SELECT jsonb_array_elements_text(
          COALESCE(user_role_settings.enabled_notification_rule_codes_json, '[]'::jsonb)
        ) AS code
        UNION ALL
        SELECT unnest(
          ARRAY[
            'DISASTER_EVENT_CREATED',
            'DISASTER_EVENT_UPDATE',
            'HOUSEHOLD_REGISTERED',
            'HOUSEHOLD_VERIFICATION',
            'EVACUEE_ATTENDANCE_UPDATE',
            'DISTRIBUTION_UPDATE',
            'SYNC_CONFLICT',
            'SYSTEM_ANOMALY'
          ]
        ) AS code
      ) merged_codes
    ) deduped_codes
  ),
  updated_at = NOW(),
  last_preference_save_at = NOW()
WHERE role_code = 'MSWDO';

UPDATE user_role_settings
SET
  enabled_notification_rule_codes_json = (
    SELECT COALESCE(jsonb_agg(code ORDER BY code), '[]'::jsonb)
    FROM (
      SELECT DISTINCT code
      FROM (
        SELECT jsonb_array_elements_text(
          COALESCE(user_role_settings.enabled_notification_rule_codes_json, '[]'::jsonb)
        ) AS code
        UNION ALL
        SELECT unnest(
          ARRAY[
            'DISASTER_EVENT_UPDATE',
            'EVACUATION_SUMMARY_REPORT',
            'LOW_STOCK',
            'CRITICAL_STOCK',
            'DONATION_STOCK_UPDATE',
            'DISTRIBUTION_UPDATE',
            'INVENTORY_INCIDENT',
            'DONATION_STOCK_ANOMALY',
            'SYSTEM_ANOMALY'
          ]
        ) AS code
      ) merged_codes
    ) deduped_codes
  ),
  updated_at = NOW(),
  last_preference_save_at = NOW()
WHERE role_code = 'MAYOR';
