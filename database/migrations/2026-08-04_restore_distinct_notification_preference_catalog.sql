INSERT INTO public.notification_rules (code, name, trigger_type, target_role_code, is_active)
VALUES
  ('LOW_STOCK', 'Low Stock Alert', 'INVENTORY_STOCK_THRESHOLD', 'MAYOR', TRUE),
  ('CRITICAL_INVENTORY_SHORTAGE', 'Critical Inventory Shortage', 'CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', TRUE),
  ('NEAR_EXPIRY_STOCK', 'Near Expiry Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('EXPIRED_STOCK', 'Expired Stock Alert', 'INVENTORY_EXPIRY', 'MAYOR', TRUE),
  ('INVENTORY_INCIDENT', 'Inventory Incident Alert', 'INVENTORY_INCIDENT', 'MAYOR', TRUE),
  ('DONATION_RECEIVED', 'Donation Received', 'DONATION_RECEIVED', 'MAYOR', TRUE),
  ('DONATION_STOCK_ANOMALY', 'Donation Anomaly', 'DONATION_ANOMALY', 'MAYOR', TRUE),
  ('SYNC_FAILURE', 'Sync Failure', 'SYNC_FAILURE', 'BARANGAY', TRUE),
  ('SYNC_CONFLICT', 'Synchronization Conflict Alert', 'SYNC_CONFLICT', 'BARANGAY', TRUE),
  ('OPERATIONAL_ANOMALY', 'Operational Anomaly Alerts', 'OPERATIONAL_ANOMALY', 'MAYOR', FALSE),
  ('SYSTEM_ANOMALY', 'System Anomaly Alert', 'SYSTEM_ANOMALY', 'BARANGAY', FALSE),
  ('SYNCHRONIZATION_CONFLICT_ALERT', 'Synchronization Conflict Alert', 'SYNC_CONFLICT', 'BARANGAY', FALSE)
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
  ('LOW_STOCK', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'WARNING', 'MANDATORY', 'OPTIONAL', 'THRESHOLD', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('CRITICAL_INVENTORY_SHORTAGE', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'THRESHOLD', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('NEAR_EXPIRY_STOCK', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'WARNING', 'MANDATORY', 'OPTIONAL', 'THRESHOLD', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('EXPIRED_STOCK', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('INVENTORY_INCIDENT', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('DONATION_RECEIVED', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'INFORMATIONAL', 'OPTIONAL', 'OPTIONAL', 'IMMEDIATE', 'ALL_SUPPORTED_CHANNELS', TRUE, NOW(), NOW()),
  ('DONATION_STOCK_ANOMALY', 'MAYOR', 'RELIEF_OPERATIONS', 'Relief Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYNC_FAILURE', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYNC_FAILURE', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYNC_CONFLICT', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('SYNC_CONFLICT', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', TRUE, NOW(), NOW()),
  ('OPERATIONAL_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('SYSTEM_ANOMALY', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('SYSTEM_ANOMALY', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('SYSTEM_ANOMALY', 'MAYOR', 'SYSTEM_MONITORING', 'System Monitoring', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('SYNCHRONIZATION_CONFLICT_ALERT', 'BARANGAY', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW()),
  ('SYNCHRONIZATION_CONFLICT_ALERT', 'MSWDO', 'SYSTEM_OPERATIONS', 'System Operations', 'CRITICAL', 'MANDATORY', 'DEFAULT_ON', 'IMMEDIATE', 'EMAIL_ONLY', FALSE, NOW(), NOW())
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
