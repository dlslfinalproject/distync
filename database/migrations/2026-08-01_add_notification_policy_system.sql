ALTER TABLE public.user_role_settings
ADD COLUMN IF NOT EXISTS notification_rule_preferences_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.notification_rule_role_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_code text NOT NULL,
  role_code text NOT NULL,
  category_code text NOT NULL,
  category_label text NOT NULL,
  priority text NOT NULL,
  in_app_policy text NOT NULL,
  email_policy text NOT NULL,
  delivery_mode text NOT NULL,
  user_configurability text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_rule_role_policies_pkey PRIMARY KEY (id),
  CONSTRAINT notification_rule_role_policies_rule_code_fkey
    FOREIGN KEY (rule_code) REFERENCES public.notification_rules(code) ON DELETE CASCADE,
  CONSTRAINT notification_rule_role_policies_role_code_fkey
    FOREIGN KEY (role_code) REFERENCES public.roles(code) ON DELETE CASCADE,
  CONSTRAINT notification_rule_role_policies_unique UNIQUE (rule_code, role_code),
  CONSTRAINT notification_rule_role_policies_priority_check
    CHECK (priority IN ('CRITICAL', 'WARNING', 'INFORMATIONAL')),
  CONSTRAINT notification_rule_role_policies_in_app_policy_check
    CHECK (in_app_policy IN ('MANDATORY', 'OPTIONAL', 'NOT_APPLICABLE')),
  CONSTRAINT notification_rule_role_policies_email_policy_check
    CHECK (email_policy IN ('DEFAULT_ON', 'OPTIONAL', 'UNAVAILABLE')),
  CONSTRAINT notification_rule_role_policies_delivery_mode_check
    CHECK (delivery_mode IN ('IMMEDIATE', 'HOURLY_SUMMARY', 'DAILY_SUMMARY', 'THRESHOLD', 'SILENT_UI_FEEDBACK')),
  CONSTRAINT notification_rule_role_policies_user_configurability_check
    CHECK (user_configurability IN ('NONE', 'EMAIL_ONLY', 'ALL_SUPPORTED_CHANNELS'))
);

CREATE INDEX IF NOT EXISTS idx_notification_rule_role_policies_role_code
  ON public.notification_rule_role_policies(role_code, category_code, rule_code);

CREATE TABLE IF NOT EXISTS public.notification_summary_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  summary_key text NOT NULL,
  rule_code text NOT NULL,
  role_code text NOT NULL,
  barangay_id uuid NULL REFERENCES public.barangays(id),
  disaster_event_id uuid NULL REFERENCES public.disaster_events(id),
  reference_scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  window_started_at timestamp with time zone NOT NULL,
  window_ends_at timestamp with time zone NOT NULL,
  ready_at timestamp with time zone NOT NULL,
  processed_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_summary_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notification_summary_events_due
  ON public.notification_summary_events(processed_at, ready_at, role_code, rule_code);

CREATE TABLE IF NOT EXISTS public.notification_delivery_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  state_key text NOT NULL,
  rule_code text NOT NULL,
  role_code text NOT NULL,
  state_value text NOT NULL,
  last_notified_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_states_pkey PRIMARY KEY (id),
  CONSTRAINT notification_delivery_states_unique UNIQUE (state_key)
);
