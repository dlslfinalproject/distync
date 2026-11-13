DO $$
DECLARE
  legacy_only_rows integer;
  malformed_modern_rows integer;
  duplicate_user_role_rows integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_role_settings'
      AND column_name = 'notification_rule_preferences_json'
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: notification_rule_preferences_json is missing from public.user_role_settings.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_role_settings'
      AND column_name = 'enabled_notification_rule_codes_json'
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: enabled_notification_rule_codes_json is already absent from public.user_role_settings.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_role_settings'
      AND column_name = 'notification_channels_json'
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: notification_channels_json is already absent from public.user_role_settings.';
  END IF;

  SELECT COUNT(*)::integer
  INTO malformed_modern_rows
  FROM public.user_role_settings
  WHERE jsonb_typeof(COALESCE(notification_rule_preferences_json, '{}'::jsonb))
    <> 'object';

  IF malformed_modern_rows > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % malformed modern notification preference rows detected.',
      malformed_modern_rows;
  END IF;

  SELECT COUNT(*)::integer
  INTO legacy_only_rows
  FROM public.user_role_settings
  WHERE COALESCE(notification_rule_preferences_json, '{}'::jsonb) = '{}'::jsonb
    AND (
      COALESCE(enabled_notification_rule_codes_json, '[]'::jsonb) <> '[]'::jsonb
      OR COALESCE(notification_channels_json, '{}'::jsonb) <> '{}'::jsonb
    );

  IF legacy_only_rows > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % legacy-only user_role_settings rows remain.',
      legacy_only_rows;
  END IF;

  SELECT COUNT(*)::integer
  INTO duplicate_user_role_rows
  FROM (
    SELECT user_id, role_code
    FROM public.user_role_settings
    GROUP BY user_id, role_code
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_user_role_rows > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % duplicate user-role settings rows detected.',
      duplicate_user_role_rows;
  END IF;
END $$;

ALTER TABLE public.user_role_settings
  DROP COLUMN enabled_notification_rule_codes_json,
  DROP COLUMN notification_channels_json;
