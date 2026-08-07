const pool = require("../src/config/db");
const {
  NOTIFICATION_POLICY_ROWS,
  NOTIFICATION_RULE_TARGETS,
} = require("../src/modules/notifications/notificationPolicy");

const STALE_RULE_CODES = [
  "CRITICAL_STOCK",
  "DISASTER_EVENT_UPDATE",
  "DISTRIBUTION_UPDATE",
  "DONATION_STOCK_UPDATE",
  "EVACUEE_ATTENDANCE_UPDATE",
  "HOUSEHOLD_VERIFICATION",
  "SYSTEM_ANOMALY",
];

const activeRuntimeRules = new Set(
  NOTIFICATION_RULE_TARGETS.filter((rule) => rule.isActive).map((rule) => rule.code),
);
const activeRuntimePolicies = new Set(
  NOTIFICATION_POLICY_ROWS.filter((policy) => policy.isActive)
    .map((policy) => `${policy.ruleCode}:${policy.roleCode}`),
);

const sortedDifference = (left, right) =>
  [...left].filter((value) => !right.has(value)).sort();

const query = async () => {
  const [
    identity,
    counts,
    allRules,
    allPolicies,
    rules,
    policies,
    historicalNotifications,
    stalePreferences,
    migrationTracking,
    staleSummaryEvents,
  ] =
    await Promise.all([
      pool.query(
        "SELECT current_database() AS database_name, current_user AS database_user, COALESCE(inet_server_addr()::text, 'managed') AS server_address",
      ),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::integer FROM notification_rules) AS total_rules,
          (SELECT COUNT(*)::integer FROM notification_rules WHERE is_active) AS active_rules,
          (SELECT COUNT(*)::integer FROM notification_rules WHERE NOT is_active) AS inactive_rules,
          (SELECT COUNT(*)::integer FROM notification_rule_role_policies) AS total_policies,
          (SELECT COUNT(*)::integer FROM notification_rule_role_policies WHERE is_active) AS active_policies,
          (SELECT COUNT(*)::integer FROM notification_rule_role_policies WHERE NOT is_active) AS inactive_policies
      `),
      pool.query(
        "SELECT code, is_active FROM notification_rules ORDER BY code",
      ),
      pool.query(`
        SELECT p.rule_code, r.is_active AS rule_active, p.role_code, p.is_active AS policy_active,
               p.category_code, p.priority, p.in_app_policy, p.email_policy, p.delivery_mode
        FROM notification_rule_role_policies p
        INNER JOIN notification_rules r ON r.code = p.rule_code
        ORDER BY p.rule_code, p.role_code
      `),
      pool.query("SELECT code FROM notification_rules WHERE is_active ORDER BY code"),
      pool.query("SELECT rule_code, role_code FROM notification_rule_role_policies WHERE is_active ORDER BY rule_code, role_code"),
      pool.query(
        "SELECT rule_code, COUNT(*)::integer AS count FROM notifications WHERE rule_code = ANY($1::text[]) GROUP BY rule_code ORDER BY rule_code",
        [STALE_RULE_CODES],
      ),
      pool.query(
        `
          SELECT preference_key, COUNT(*)::integer AS count
          FROM user_role_settings settings
          CROSS JOIN LATERAL jsonb_object_keys(
            COALESCE(settings.notification_rule_preferences_json, '{}'::jsonb)
          ) AS preference_key
          WHERE preference_key = ANY($1::text[])
          GROUP BY preference_key
          ORDER BY preference_key
        `,
        [STALE_RULE_CODES],
      ),
      pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('schema_migrations', 'migration_history', 'supabase_migrations')
        ORDER BY table_name
      `),
      pool.query(
        "SELECT rule_code, COUNT(*)::integer AS count FROM notification_summary_events WHERE rule_code = ANY($1::text[]) AND processed_at IS NULL GROUP BY rule_code ORDER BY rule_code",
        [STALE_RULE_CODES],
      ),
    ]);

  const liveRules = new Set(rules.rows.map((row) => row.code));
  const livePolicies = new Set(
    policies.rows.map((row) => `${row.rule_code}:${row.role_code}`),
  );

  return {
    database: identity.rows[0],
    counts: counts.rows[0],
    inventory: {
      rules: allRules.rows,
      rolePolicies: allPolicies.rows,
    },
    activeRuleDiff: {
      runtimeOnly: sortedDifference(activeRuntimeRules, liveRules),
      liveOnly: sortedDifference(liveRules, activeRuntimeRules),
      matched: [...activeRuntimeRules].filter((code) => liveRules.has(code)).sort(),
    },
    activePolicyDiff: {
      runtimeOnly: sortedDifference(activeRuntimePolicies, livePolicies),
      liveOnly: sortedDifference(livePolicies, activeRuntimePolicies),
      matched: [...activeRuntimePolicies]
        .filter((key) => livePolicies.has(key))
        .sort(),
    },
    historicalNotificationCounts: historicalNotifications.rows,
    stalePreferenceKeyCounts: stalePreferences.rows,
    migrationTrackingTables: migrationTracking.rows.map((row) => row.table_name),
    pendingStaleSummaryEventCounts: staleSummaryEvents.rows,
  };
};

query()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(`Notification policy audit failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
