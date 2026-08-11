const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  CANONICAL_NOTIFICATION_RULES,
  NOTIFICATION_POLICY_ROWS,
  getCanonicalRuleCode,
  getPolicyRolesForRule,
  isVisibleInSettings,
} = require("../src/modules/notifications/notificationPolicy");

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../database/migrations/2026-08-07_reconcile_notification_policy.sql",
  ),
  "utf8",
);

test("Block 3 policy catalog has unique canonical codes and complete static policy fields", () => {
  const codes = CANONICAL_NOTIFICATION_RULES.map((rule) => rule.code);
  assert.equal(new Set(codes).size, codes.length);

  NOTIFICATION_POLICY_ROWS.forEach((row) => {
    assert.ok(["CRITICAL", "WARNING", "INFORMATIONAL"].includes(row.priority));
    assert.ok(row.categoryCode);
    assert.ok(row.deliveryMode);
    assert.ok(row.roleCode);
  });
});

test("Block 3 keeps LOW_STOCK active and retires orphan generic rules", () => {
  assert.ok(getPolicyRolesForRule("LOW_STOCK").length > 0);
  assert.equal(isVisibleInSettings("LOW_STOCK", "MAYOR"), true);

  ["SYSTEM_ALERT", "OPERATIONAL_ANOMALY"].forEach((ruleCode) => {
    const rule = CANONICAL_NOTIFICATION_RULES.find((item) => item.code === ruleCode);
    assert.equal(rule.isActive, false);
    assert.equal(isVisibleInSettings(ruleCode, rule.targetRoleCode), false);
  });
});

test("Block 3 preserves only verified direct alias canonicalization", () => {
  assert.equal(getCanonicalRuleCode("CRITICAL_STOCK"), "CRITICAL_INVENTORY_SHORTAGE");
  assert.equal(getCanonicalRuleCode("DISASTER_EVENT_UPDATE"), "DISASTER_EVENT_UPDATED");
  assert.equal(getCanonicalRuleCode("DISTRIBUTION_UPDATE"), "DISTRIBUTION_UPDATE");
});

test("Block 3 reconciliation migration is narrow, reversible by reactivation, and preserves notification history", () => {
  assert.match(reconciliationMigration, /^BEGIN;/);
  assert.match(reconciliationMigration, /COMMIT;\s*$/);
  assert.match(reconciliationMigration, /'SYSTEM_ALERT', 'OPERATIONAL_ANOMALY'/);
  assert.match(reconciliationMigration, /'DISTRIBUTION_UPDATE'/);
  assert.doesNotMatch(reconciliationMigration, /\bDELETE\b/i);
  assert.doesNotMatch(reconciliationMigration, /\bnotifications\b/i);
  assert.doesNotMatch(reconciliationMigration, /user_role_settings/i);
});
