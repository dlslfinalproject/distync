const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  NOTIFICATION_POLICY_ROWS,
  NOTIFICATION_RULE_TARGETS,
} = require("../src/modules/notifications/notificationPolicy");

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-05_seed_canonical_notification_role_policies.sql",
);
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const aliasMigrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-05_consolidate_legacy_notification_rule_aliases.sql",
);
const aliasMigrationSql = fs.readFileSync(aliasMigrationPath, "utf8");
const correctiveMigrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-08-07_deactivate_remaining_legacy_notification_policy.sql",
);
const correctiveMigrationSql = fs.readFileSync(correctiveMigrationPath, "utf8");

const extractValueTuples = (sql, sectionLabel) => {
  const sectionPattern = new RegExp(
    `${sectionLabel}[\\s\\S]*?VALUES\\s*([\\s\\S]*?)\\)\\s*AS rows`,
  );
  const sectionMatch = sql.match(sectionPattern);

  if (!sectionMatch) {
    throw new Error(`Unable to locate ${sectionLabel} values in migration SQL.`);
  }

  return sectionMatch[1]
    .trim()
    .replace(/^\(/, "")
    .replace(/\)\s*,?\s*$/, "")
    .split(/\)\s*,\s*\(/)
    .map((tuple) =>
      tuple
      .split(",")
      .map((value) => value.trim().replace(/^'|'$/g, "").replace(/''/g, "'")),
    );
};

test("original notification policy seed records its historical policy snapshot", () => {
  const migrationRules = extractValueTuples(migrationSql, "WITH canonical_rules AS").map(
    ([code, name, triggerType, targetRoleCode, isActive]) => ({
      code,
      name,
      triggerType,
      targetRoleCode,
      isActive: isActive === "TRUE",
    }),
  );

  const historicalRules = NOTIFICATION_RULE_TARGETS.map((rule) => ({
    code: rule.code,
    name: rule.name,
    triggerType: rule.triggerType,
    targetRoleCode: rule.targetRoleCode,
    // These two rules were retired by the later Block 3 reconciliation.
    isActive: ["SYSTEM_ALERT", "OPERATIONAL_ANOMALY"].includes(rule.code)
      ? true
      : rule.isActive ?? true,
  }));

  assert.deepEqual(migrationRules, historicalRules);
});

test("original notification policy seed records its historical role policy snapshot", () => {
  const migrationPolicies = extractValueTuples(
    migrationSql,
    "WITH canonical_policies AS",
  ).map(
    ([
      ruleCode,
      roleCode,
      categoryCode,
      categoryLabel,
      priority,
      inAppPolicy,
      emailPolicy,
      deliveryMode,
      userConfigurability,
      isActive,
    ]) => ({
      ruleCode,
      roleCode,
      categoryCode,
      categoryLabel,
      priority,
      inAppPolicy,
      emailPolicy,
      deliveryMode,
      userConfigurability,
      isActive: isActive === "TRUE",
    }),
  );

  const historicalPolicies = NOTIFICATION_POLICY_ROWS.map((row) => ({
    ruleCode: row.ruleCode,
    roleCode: row.roleCode,
    categoryCode: row.categoryCode,
    categoryLabel: row.categoryLabel,
    priority: row.priority,
    inAppPolicy: row.inAppPolicy,
    emailPolicy: row.emailPolicy,
    deliveryMode: row.deliveryMode,
    userConfigurability: row.userConfigurability,
    isActive: ["SYSTEM_ALERT", "OPERATIONAL_ANOMALY"].includes(row.ruleCode)
      ? true
      : row.isActive ?? true,
  }));

  assert.deepEqual(migrationPolicies, historicalPolicies);
});

test("notification policy migration is wrapped in a transaction", () => {
  assert.match(migrationSql, /^\s*BEGIN;/);
  assert.match(migrationSql, /COMMIT;\s*$/);
});

test("notification policy migration does not touch stored user notification preferences", () => {
  assert.doesNotMatch(migrationSql, /user_role_settings/i);
  assert.doesNotMatch(migrationSql, /notification_rule_preferences_json/i);
  assert.doesNotMatch(migrationSql, /notification_channels_json/i);
});

test("notification policy migration uses guarded conflict updates", () => {
  const distinctGuardCount =
    migrationSql.match(/IS DISTINCT FROM/g)?.length || 0;

  assert.ok(distinctGuardCount >= 2);
});

test("legacy alias consolidation migration only migrates verified direct aliases", () => {
  assert.match(aliasMigrationSql, /CRITICAL_STOCK/);
  assert.match(aliasMigrationSql, /DISASTER_EVENT_UPDATE/);
  assert.match(aliasMigrationSql, /EVACUEE_ATTENDANCE_UPDATE/);
  assert.match(aliasMigrationSql, /HOUSEHOLD_VERIFICATION/);
  assert.match(aliasMigrationSql, /SYNCHRONIZATION_CONFLICT_ALERT/);
  assert.doesNotMatch(aliasMigrationSql, /DONATION_STOCK_UPDATE/);
  assert.doesNotMatch(aliasMigrationSql, /DISTRIBUTION_UPDATE/);
  assert.doesNotMatch(aliasMigrationSql, /SYSTEM_ANOMALY/);
  assert.doesNotMatch(aliasMigrationSql, /LOW_STOCK', ARRAY\['CRITICAL_STOCK'/);
});

test("legacy alias consolidation migration wraps writes in a transaction and preserves settings JSON scope", () => {
  assert.match(aliasMigrationSql, /^\s*BEGIN;/);
  assert.match(aliasMigrationSql, /COMMIT;\s*$/);
  assert.match(aliasMigrationSql, /notification_rule_preferences_json/);
  assert.doesNotMatch(aliasMigrationSql, /enabled_notification_rule_codes_json/i);
  assert.doesNotMatch(aliasMigrationSql, /notification_channels_json/i);
  assert.doesNotMatch(aliasMigrationSql, /last_preference_save_at/i);
});

test("legacy alias consolidation migration deduplicates policy candidates before upsert", () => {
  assert.match(aliasMigrationSql, /ROW_NUMBER\(\)\s+OVER\s*\(/);
  assert.match(
    aliasMigrationSql,
    /PARTITION BY alias_pairs\.canonical_rule_code,\s*legacy_policies\.role_code/i,
  );
  assert.match(aliasMigrationSql, /candidate_rank = 1/);
  assert.match(aliasMigrationSql, /TRUE AS is_active/);
  assert.match(
    aliasMigrationSql,
    /canonical_policies\.rule_code IS NOT NULL[\s\S]*alias_pairs\.alias_precedence/i,
  );
});

test("legacy alias consolidation migration deactivates legacy rows only after active canonical coverage exists", () => {
  assert.match(
    aliasMigrationSql,
    /canonical_policies\.is_active = TRUE/i,
  );
  assert.match(
    aliasMigrationSql,
    /canonical_policy\.is_active = TRUE/i,
  );
  assert.match(
    aliasMigrationSql,
    /NOT EXISTS\s*\([\s\S]*legacy_policy[\s\S]*NOT EXISTS[\s\S]*canonical_policy/i,
  );
});

test("corrective policy migration deactivates every remaining legacy rule and policy without rewriting preferences", () => {
  const expectedLegacyRules = [
    "CRITICAL_STOCK",
    "DISASTER_EVENT_UPDATE",
    "DISTRIBUTION_UPDATE",
    "DONATION_STOCK_UPDATE",
    "EVACUEE_ATTENDANCE_UPDATE",
    "HOUSEHOLD_VERIFICATION",
    "SYSTEM_ANOMALY",
  ];

  assert.match(correctiveMigrationSql, /^\s*BEGIN;/);
  assert.match(correctiveMigrationSql, /COMMIT;\s*$/);
  assert.doesNotMatch(correctiveMigrationSql, /user_role_settings|notification_rule_preferences_json/i);
  assert.doesNotMatch(correctiveMigrationSql, /DELETE\s+FROM|INSERT\s+INTO/i);

  for (const code of expectedLegacyRules) {
    assert.match(correctiveMigrationSql, new RegExp(`\\('${code}'\\)`));
  }

  assert.match(
    correctiveMigrationSql,
    /UPDATE public\.notification_rule_role_policies[\s\S]*is_active = FALSE/i,
  );
  assert.match(
    correctiveMigrationSql,
    /UPDATE public\.notification_rules[\s\S]*is_active = FALSE/i,
  );
});
