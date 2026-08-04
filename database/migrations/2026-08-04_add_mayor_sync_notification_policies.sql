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
  (
    'SYNC_FAILURE',
    'MAYOR',
    'SYSTEM_MONITORING',
    'System Monitoring',
    'CRITICAL',
    'MANDATORY',
    'DEFAULT_ON',
    'IMMEDIATE',
    'EMAIL_ONLY',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'SYNC_CONFLICT',
    'MAYOR',
    'SYSTEM_MONITORING',
    'System Monitoring',
    'CRITICAL',
    'MANDATORY',
    'DEFAULT_ON',
    'IMMEDIATE',
    'EMAIL_ONLY',
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (rule_code, role_code)
DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_label = EXCLUDED.category_label,
  priority = EXCLUDED.priority,
  in_app_policy = EXCLUDED.in_app_policy,
  email_policy = EXCLUDED.email_policy,
  delivery_mode = EXCLUDED.delivery_mode,
  user_configurability = EXCLUDED.user_configurability,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE public.notification_rules
SET is_active = TRUE
WHERE code IN ('SYNC_FAILURE', 'SYNC_CONFLICT');

UPDATE public.notification_rule_role_policies
SET is_active = FALSE,
    updated_at = NOW()
WHERE rule_code = 'SYNCHRONIZATION_CONFLICT_ALERT'
  AND role_code = 'MAYOR';
