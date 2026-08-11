BEGIN;

WITH verified_rule_targets AS (
  SELECT *
  FROM (
    VALUES
      (
        'CRITICAL_INVENTORY_SHORTAGE',
        'Critical Inventory Shortage',
        'CRITICAL_INVENTORY_SHORTAGE',
        'MAYOR'
      ),
      (
        'DISASTER_EVENT_UPDATED',
        'Disaster Event Updates',
        'DISASTER_EVENT_UPDATED',
        'MSWDO'
      ),
      (
        'EVACUEE_ATTENDANCE_UPDATED',
        'Evacuee Attendance Updates',
        'EVACUEE_ATTENDANCE_UPDATED',
        'BARANGAY'
      ),
      (
        'HOUSEHOLD_VERIFICATION_UPDATED',
        'Household Verification Updates',
        'HOUSEHOLD_VERIFICATION_UPDATED',
        'BARANGAY'
      ),
      (
        'SYNC_CONFLICT',
        'Synchronization Conflict Alert',
        'SYNC_CONFLICT',
        'BARANGAY'
      )
  ) AS rows(
    canonical_rule_code,
    canonical_name,
    canonical_trigger_type,
    canonical_target_role_code
  )
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
  canonical_rule_code,
  canonical_name,
  canonical_trigger_type,
  canonical_target_role_code,
  TRUE,
  NOW()
FROM verified_rule_targets
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  trigger_type = EXCLUDED.trigger_type,
  target_role_code = EXCLUDED.target_role_code,
  is_active = TRUE
WHERE
  public.notification_rules.name IS DISTINCT FROM EXCLUDED.name
  OR public.notification_rules.trigger_type IS DISTINCT FROM EXCLUDED.trigger_type
  OR public.notification_rules.target_role_code IS DISTINCT FROM EXCLUDED.target_role_code
  OR public.notification_rules.is_active IS DISTINCT FROM TRUE;

WITH alias_pairs AS (
  SELECT *
  FROM (
    VALUES
      ('CRITICAL_INVENTORY_SHORTAGE', 'CRITICAL_STOCK', 1),
      ('DISASTER_EVENT_UPDATED', 'DISASTER_EVENT_UPDATE', 1),
      ('EVACUEE_ATTENDANCE_UPDATED', 'EVACUEE_ATTENDANCE_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION', 2),
      ('SYNC_CONFLICT', 'SYNCHRONIZATION_CONFLICT_ALERT', 1)
  ) AS rows(
    canonical_rule_code,
    legacy_rule_code,
    alias_precedence
  )
),
policy_candidates AS (
  SELECT
    alias_pairs.canonical_rule_code AS rule_code,
    legacy_policies.role_code,
    COALESCE(canonical_policies.category_code, legacy_policies.category_code) AS category_code,
    COALESCE(canonical_policies.category_label, legacy_policies.category_label) AS category_label,
    COALESCE(canonical_policies.priority, legacy_policies.priority) AS priority,
    COALESCE(canonical_policies.in_app_policy, legacy_policies.in_app_policy) AS in_app_policy,
    COALESCE(canonical_policies.email_policy, legacy_policies.email_policy) AS email_policy,
    COALESCE(canonical_policies.delivery_mode, legacy_policies.delivery_mode) AS delivery_mode,
    COALESCE(
      canonical_policies.user_configurability,
      legacy_policies.user_configurability
    ) AS user_configurability,
    TRUE AS is_active,
    COALESCE(canonical_policies.created_at, legacy_policies.created_at, NOW()) AS created_at,
    ROW_NUMBER() OVER (
      PARTITION BY alias_pairs.canonical_rule_code, legacy_policies.role_code
      ORDER BY
        CASE
          WHEN canonical_policies.rule_code IS NOT NULL THEN 0
          ELSE 1
        END,
        alias_pairs.alias_precedence,
        legacy_policies.updated_at DESC NULLS LAST,
        alias_pairs.legacy_rule_code
    ) AS candidate_rank
  FROM alias_pairs
  INNER JOIN public.notification_rule_role_policies legacy_policies
    ON legacy_policies.rule_code = alias_pairs.legacy_rule_code
  LEFT JOIN public.notification_rule_role_policies canonical_policies
    ON canonical_policies.rule_code = alias_pairs.canonical_rule_code
    AND canonical_policies.role_code = legacy_policies.role_code
),
prepared_policy_rows AS (
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
    created_at
  FROM policy_candidates
  WHERE candidate_rank = 1
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
  created_at,
  NOW()
FROM prepared_policy_rows
ON CONFLICT (rule_code, role_code) DO UPDATE SET
  category_code = EXCLUDED.category_code,
  category_label = EXCLUDED.category_label,
  priority = EXCLUDED.priority,
  in_app_policy = EXCLUDED.in_app_policy,
  email_policy = EXCLUDED.email_policy,
  delivery_mode = EXCLUDED.delivery_mode,
  user_configurability = EXCLUDED.user_configurability,
  is_active = TRUE,
  updated_at = NOW()
WHERE
  public.notification_rule_role_policies.category_code IS DISTINCT FROM EXCLUDED.category_code
  OR public.notification_rule_role_policies.category_label IS DISTINCT FROM EXCLUDED.category_label
  OR public.notification_rule_role_policies.priority IS DISTINCT FROM EXCLUDED.priority
  OR public.notification_rule_role_policies.in_app_policy IS DISTINCT FROM EXCLUDED.in_app_policy
  OR public.notification_rule_role_policies.email_policy IS DISTINCT FROM EXCLUDED.email_policy
  OR public.notification_rule_role_policies.delivery_mode IS DISTINCT FROM EXCLUDED.delivery_mode
  OR public.notification_rule_role_policies.user_configurability IS DISTINCT FROM EXCLUDED.user_configurability
  OR public.notification_rule_role_policies.is_active IS DISTINCT FROM TRUE;

WITH preference_candidates AS (
  SELECT
    settings.id,
    CASE
      WHEN merged_preference = '{}'::jsonb THEN
        base_preferences - 'CRITICAL_STOCK'
      ELSE
        jsonb_set(
          base_preferences - 'CRITICAL_STOCK',
          '{CRITICAL_INVENTORY_SHORTAGE}',
          merged_preference,
          TRUE
        )
    END AS next_preferences
  FROM (
    SELECT
      id,
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) AS base_preferences,
      jsonb_strip_nulls(
        jsonb_build_object(
          'inApp',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_INVENTORY_SHORTAGE' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_INVENTORY_SHORTAGE' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_STOCK' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_STOCK' -> 'inApp'
            ELSE NULL
          END,
          'email',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_INVENTORY_SHORTAGE' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_INVENTORY_SHORTAGE' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_STOCK' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'CRITICAL_STOCK' -> 'email'
            ELSE NULL
          END
        )
      ) AS merged_preference
    FROM public.user_role_settings
    WHERE COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'CRITICAL_STOCK'
  ) settings
),
preference_updates AS (
  SELECT id, next_preferences
  FROM preference_candidates
  WHERE next_preferences IS DISTINCT FROM (
    SELECT notification_rule_preferences_json
    FROM public.user_role_settings
    WHERE public.user_role_settings.id = preference_candidates.id
  )
)
UPDATE public.user_role_settings settings
SET
  notification_rule_preferences_json = preference_updates.next_preferences,
  updated_at = NOW()
FROM preference_updates
WHERE settings.id = preference_updates.id;

WITH preference_candidates AS (
  SELECT
    settings.id,
    CASE
      WHEN merged_preference = '{}'::jsonb THEN
        base_preferences - 'DISASTER_EVENT_UPDATE'
      ELSE
        jsonb_set(
          base_preferences - 'DISASTER_EVENT_UPDATE',
          '{DISASTER_EVENT_UPDATED}',
          merged_preference,
          TRUE
        )
    END AS next_preferences
  FROM (
    SELECT
      id,
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) AS base_preferences,
      jsonb_strip_nulls(
        jsonb_build_object(
          'inApp',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATED' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATED' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATE' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATE' -> 'inApp'
            ELSE NULL
          END,
          'email',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATED' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATED' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATE' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'DISASTER_EVENT_UPDATE' -> 'email'
            ELSE NULL
          END
        )
      ) AS merged_preference
    FROM public.user_role_settings
    WHERE COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'DISASTER_EVENT_UPDATE'
  ) settings
),
preference_updates AS (
  SELECT id, next_preferences
  FROM preference_candidates
  WHERE next_preferences IS DISTINCT FROM (
    SELECT notification_rule_preferences_json
    FROM public.user_role_settings
    WHERE public.user_role_settings.id = preference_candidates.id
  )
)
UPDATE public.user_role_settings settings
SET
  notification_rule_preferences_json = preference_updates.next_preferences,
  updated_at = NOW()
FROM preference_updates
WHERE settings.id = preference_updates.id;

WITH preference_candidates AS (
  SELECT
    settings.id,
    CASE
      WHEN merged_preference = '{}'::jsonb THEN
        base_preferences - 'EVACUEE_ATTENDANCE_UPDATE'
      ELSE
        jsonb_set(
          base_preferences - 'EVACUEE_ATTENDANCE_UPDATE',
          '{EVACUEE_ATTENDANCE_UPDATED}',
          merged_preference,
          TRUE
        )
    END AS next_preferences
  FROM (
    SELECT
      id,
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) AS base_preferences,
      jsonb_strip_nulls(
        jsonb_build_object(
          'inApp',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATED' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATED' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATE' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATE' -> 'inApp'
            ELSE NULL
          END,
          'email',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATED' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATED' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATE' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'EVACUEE_ATTENDANCE_UPDATE' -> 'email'
            ELSE NULL
          END
        )
      ) AS merged_preference
    FROM public.user_role_settings
    WHERE COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'EVACUEE_ATTENDANCE_UPDATE'
  ) settings
),
preference_updates AS (
  SELECT id, next_preferences
  FROM preference_candidates
  WHERE next_preferences IS DISTINCT FROM (
    SELECT notification_rule_preferences_json
    FROM public.user_role_settings
    WHERE public.user_role_settings.id = preference_candidates.id
  )
)
UPDATE public.user_role_settings settings
SET
  notification_rule_preferences_json = preference_updates.next_preferences,
  updated_at = NOW()
FROM preference_updates
WHERE settings.id = preference_updates.id;

WITH preference_candidates AS (
  SELECT
    settings.id,
    CASE
      WHEN merged_preference = '{}'::jsonb THEN
        (base_preferences - 'HOUSEHOLD_VERIFICATION') - 'HOUSEHOLD_VERIFICATION_UPDATE'
      ELSE
        jsonb_set(
          (base_preferences - 'HOUSEHOLD_VERIFICATION') - 'HOUSEHOLD_VERIFICATION_UPDATE',
          '{HOUSEHOLD_VERIFICATION_UPDATED}',
          merged_preference,
          TRUE
        )
    END AS next_preferences
  FROM (
    SELECT
      id,
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) AS base_preferences,
      jsonb_strip_nulls(
        jsonb_build_object(
          'inApp',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATED' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATED' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATE' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATE' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION' -> 'inApp'
            ELSE NULL
          END,
          'email',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATED' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATED' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATE' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION_UPDATE' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'HOUSEHOLD_VERIFICATION' -> 'email'
            ELSE NULL
          END
        )
      ) AS merged_preference
    FROM public.user_role_settings
    WHERE
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'HOUSEHOLD_VERIFICATION'
      OR COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'HOUSEHOLD_VERIFICATION_UPDATE'
  ) settings
),
preference_updates AS (
  SELECT id, next_preferences
  FROM preference_candidates
  WHERE next_preferences IS DISTINCT FROM (
    SELECT notification_rule_preferences_json
    FROM public.user_role_settings
    WHERE public.user_role_settings.id = preference_candidates.id
  )
)
UPDATE public.user_role_settings settings
SET
  notification_rule_preferences_json = preference_updates.next_preferences,
  updated_at = NOW()
FROM preference_updates
WHERE settings.id = preference_updates.id;

WITH preference_candidates AS (
  SELECT
    settings.id,
    CASE
      WHEN merged_preference = '{}'::jsonb THEN
        base_preferences - 'SYNCHRONIZATION_CONFLICT_ALERT'
      ELSE
        jsonb_set(
          base_preferences - 'SYNCHRONIZATION_CONFLICT_ALERT',
          '{SYNC_CONFLICT}',
          merged_preference,
          TRUE
        )
    END AS next_preferences
  FROM (
    SELECT
      id,
      COALESCE(notification_rule_preferences_json, '{}'::jsonb) AS base_preferences,
      jsonb_strip_nulls(
        jsonb_build_object(
          'inApp',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNC_CONFLICT' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNC_CONFLICT' -> 'inApp'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNCHRONIZATION_CONFLICT_ALERT' ? 'inApp'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNCHRONIZATION_CONFLICT_ALERT' -> 'inApp'
            ELSE NULL
          END,
          'email',
          CASE
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNC_CONFLICT' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNC_CONFLICT' -> 'email'
            WHEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNCHRONIZATION_CONFLICT_ALERT' ? 'email'
              THEN COALESCE(notification_rule_preferences_json, '{}'::jsonb) -> 'SYNCHRONIZATION_CONFLICT_ALERT' -> 'email'
            ELSE NULL
          END
        )
      ) AS merged_preference
    FROM public.user_role_settings
    WHERE COALESCE(notification_rule_preferences_json, '{}'::jsonb) ? 'SYNCHRONIZATION_CONFLICT_ALERT'
  ) settings
),
preference_updates AS (
  SELECT id, next_preferences
  FROM preference_candidates
  WHERE next_preferences IS DISTINCT FROM (
    SELECT notification_rule_preferences_json
    FROM public.user_role_settings
    WHERE public.user_role_settings.id = preference_candidates.id
  )
)
UPDATE public.user_role_settings settings
SET
  notification_rule_preferences_json = preference_updates.next_preferences,
  updated_at = NOW()
FROM preference_updates
WHERE settings.id = preference_updates.id;

WITH alias_pairs AS (
  SELECT *
  FROM (
    VALUES
      ('CRITICAL_INVENTORY_SHORTAGE', 'CRITICAL_STOCK', 1),
      ('DISASTER_EVENT_UPDATED', 'DISASTER_EVENT_UPDATE', 1),
      ('EVACUEE_ATTENDANCE_UPDATED', 'EVACUEE_ATTENDANCE_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION', 2),
      ('SYNC_CONFLICT', 'SYNCHRONIZATION_CONFLICT_ALERT', 1)
  ) AS rows(
    canonical_rule_code,
    legacy_rule_code,
    alias_precedence
  )
),
legacy_policy_updates AS (
  SELECT legacy_policies.id
  FROM public.notification_rule_role_policies legacy_policies
  INNER JOIN alias_pairs
    ON alias_pairs.legacy_rule_code = legacy_policies.rule_code
  WHERE legacy_policies.is_active IS DISTINCT FROM FALSE
    AND EXISTS (
      SELECT 1
      FROM public.notification_rule_role_policies canonical_policies
      WHERE canonical_policies.rule_code = alias_pairs.canonical_rule_code
        AND canonical_policies.role_code = legacy_policies.role_code
        AND canonical_policies.is_active = TRUE
    )
)
UPDATE public.notification_rule_role_policies legacy_policies
SET
  is_active = FALSE,
  updated_at = NOW()
FROM legacy_policy_updates
WHERE legacy_policies.id = legacy_policy_updates.id;

WITH alias_pairs AS (
  SELECT *
  FROM (
    VALUES
      ('CRITICAL_INVENTORY_SHORTAGE', 'CRITICAL_STOCK', 1),
      ('DISASTER_EVENT_UPDATED', 'DISASTER_EVENT_UPDATE', 1),
      ('EVACUEE_ATTENDANCE_UPDATED', 'EVACUEE_ATTENDANCE_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION_UPDATE', 1),
      ('HOUSEHOLD_VERIFICATION_UPDATED', 'HOUSEHOLD_VERIFICATION', 2),
      ('SYNC_CONFLICT', 'SYNCHRONIZATION_CONFLICT_ALERT', 1)
  ) AS rows(
    canonical_rule_code,
    legacy_rule_code,
    alias_precedence
  )
),
legacy_rule_updates AS (
  SELECT DISTINCT legacy_rules.code
  FROM public.notification_rules legacy_rules
  INNER JOIN alias_pairs
    ON alias_pairs.legacy_rule_code = legacy_rules.code
  WHERE legacy_rules.is_active IS DISTINCT FROM FALSE
    AND EXISTS (
      SELECT 1
      FROM public.notification_rules canonical_rules
      WHERE canonical_rules.code = alias_pairs.canonical_rule_code
        AND canonical_rules.is_active = TRUE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.notification_rule_role_policies legacy_policy
      WHERE legacy_policy.rule_code = legacy_rules.code
        AND legacy_policy.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM public.notification_rule_role_policies canonical_policy
          WHERE canonical_policy.rule_code = alias_pairs.canonical_rule_code
            AND canonical_policy.role_code = legacy_policy.role_code
            AND canonical_policy.is_active = TRUE
        )
    )
)
UPDATE public.notification_rules legacy_rules
SET is_active = FALSE
FROM legacy_rule_updates
WHERE legacy_rules.code = legacy_rule_updates.code;

COMMIT;
