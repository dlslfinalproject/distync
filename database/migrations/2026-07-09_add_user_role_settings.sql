CREATE TABLE IF NOT EXISTS public.user_role_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_code character varying NOT NULL,
  profile_picture_data_url text,
  profile_picture_file_name character varying,
  enabled_notification_rule_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_channels_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_export_format character varying NOT NULL DEFAULT 'excel',
  two_factor_enabled boolean NOT NULL DEFAULT false,
  last_local_password_change_at timestamp with time zone,
  last_two_factor_preference_update_at timestamp with time zone,
  last_profile_update_at timestamp with time zone,
  last_preference_save_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_role_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_role_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_role_settings_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code),
  CONSTRAINT user_role_settings_user_role_unique UNIQUE (user_id, role_code),
  CONSTRAINT chk_user_role_settings_export_format CHECK (
    preferred_export_format::text = ANY (
      ARRAY[
        'csv'::character varying,
        'excel'::character varying,
        'pdf'::character varying
      ]::text[]
    )
  )
);

INSERT INTO public.user_role_settings (
  user_id,
  role_code,
  profile_picture_data_url,
  profile_picture_file_name,
  enabled_notification_rule_codes_json,
  notification_channels_json,
  preferred_export_format,
  two_factor_enabled,
  last_local_password_change_at,
  last_two_factor_preference_update_at,
  last_profile_update_at,
  last_preference_save_at,
  created_at,
  updated_at
)
SELECT
  latest_snapshot.user_id,
  latest_snapshot.role_code,
  NULLIF(latest_snapshot.new_values_json #>> '{profile,profilePictureDataUrl}', ''),
  NULLIF(latest_snapshot.new_values_json #>> '{profile,profilePictureFileName}', ''),
  COALESCE(latest_snapshot.new_values_json -> 'enabledNotificationRuleCodes', '[]'::jsonb),
  COALESCE(latest_snapshot.new_values_json -> 'notificationChannels', '{}'::jsonb),
  CASE LOWER(COALESCE(latest_snapshot.new_values_json ->> 'preferredExportFormat', 'excel'))
    WHEN 'csv' THEN 'csv'
    WHEN 'pdf' THEN 'pdf'
    ELSE 'excel'
  END,
  CASE LOWER(COALESCE(latest_snapshot.new_values_json #>> '{security,twoFactorEnabled}', 'false'))
    WHEN 'true' THEN TRUE
    ELSE FALSE
  END,
  NULLIF(latest_snapshot.new_values_json #>> '{security,lastLocalPasswordChangeAt}', '')::timestamp with time zone,
  NULLIF(latest_snapshot.new_values_json #>> '{security,lastTwoFactorPreferenceUpdateAt}', '')::timestamp with time zone,
  NULLIF(latest_snapshot.new_values_json #>> '{metadata,lastProfileUpdateAt}', '')::timestamp with time zone,
  COALESCE(
    NULLIF(latest_snapshot.new_values_json #>> '{metadata,lastPreferenceSaveAt}', '')::timestamp with time zone,
    latest_snapshot.created_at
  ),
  latest_snapshot.created_at,
  latest_snapshot.created_at
FROM (
  SELECT DISTINCT ON (user_id, role_code)
    id,
    user_id,
    role_code,
    new_values_json,
    created_at
  FROM public.audit_logs
  WHERE action = 'UPSERT_ROLE_SETTINGS'
    AND entity_type = 'ROLE_SETTINGS'
    AND user_id IS NOT NULL
    AND role_code IN ('BARANGAY', 'MSWDO', 'MAYOR')
  ORDER BY user_id, role_code, created_at DESC, id DESC
) AS latest_snapshot
ON CONFLICT (user_id, role_code) DO NOTHING;
