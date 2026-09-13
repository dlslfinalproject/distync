const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const migrationsDirectory = path.join(repositoryRoot, "database", "migrations");
const migrationName = "2026-09-13_harden_public_acl_defaults.sql";
const migrationPath = path.join(migrationsDirectory, migrationName);

const tableNames = [
  "anomaly_reviews", "audit_logs", "barangays",
  "default_emergency_donation_needs", "devices", "disaster_event_barangays",
  "disaster_event_code_counters", "disaster_events",
  "distribution_transaction_items", "distribution_transaction_relief_pack_templates",
  "distribution_transactions", "donation_items", "donation_needs", "donations",
  "error_logs", "evacuation_centers", "evacuation_logs", "evacuee_sectors",
  "evacuees", "forecast_results", "forecast_runs",
  "household_privacy_consents", "household_sectors", "households",
  "inventory_batches", "inventory_domain_effect_intents",
  "inventory_item_stock_forms", "inventory_items",
  "inventory_transaction_reference_counters", "inventory_transactions",
  "notification_delivery_states", "notification_email_deliveries",
  "notification_outbox", "notification_recipients",
  "notification_rule_role_policies", "notification_rules",
  "notification_summary_events", "notifications", "permissions",
  "relief_pack_template_disaster_types", "relief_pack_template_items",
  "relief_pack_templates", "role_permissions", "roles", "sectors",
  "stub_donated_relief_pack_assignments", "stubs", "sync_conflicts",
  "sync_transactions", "user_role_settings", "user_roles", "users",
];

const viewNames = [
  "donation_transparency_summary",
  "public_donation_summary",
];

const functionSignatures = [
  "assign_inventory_transaction_reference_no()",
  "generate_disaster_event_code_safe(date)",
  "increment_inventory_batch_stock_version()",
  "rls_auto_enable()",
  "set_distribution_receipt_no()",
  "set_stub_qr_code_value()",
  "trg_set_disaster_event_code_safe()",
];

const readMigration = () => fs.readFileSync(migrationPath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const escapeRegExp = (value) =>
  value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

test("exactly one forward public ACL hardening migration exists", () => {
  const matchingMigrations = fs
    .readdirSync(migrationsDirectory)
    .filter((name) => /acl|privilege/i.test(name))
    .filter((name) => /harden.*public|public.*harden/i.test(name));
  assert.deepEqual(matchingMigrations, [migrationName]);
  assert.equal(fs.existsSync(migrationPath), true);
});

test("migration explicitly revokes current DISTYNC table and view ACLs", () => {
  const executableSql = stripSqlComments(readMigration());
  for (const objectName of [...tableNames, ...viewNames]) {
    const escapedName = escapeRegExp(objectName);
    assert.match(
      executableSql,
      new RegExp(
        "REVOKE ALL PRIVILEGES ON TABLE public\\." +
          escapedName +
          " FROM anon, authenticated;",
        "i",
      ),
    );
  }
  assert.equal(
    (executableSql.match(/REVOKE ALL PRIVILEGES ON TABLE public\./gi) || [])
      .length,
    tableNames.length + viewNames.length,
  );
  assert.doesNotMatch(executableSql, /ALL TABLES IN SCHEMA/i);
});

test("migration revokes broad function EXECUTE with exact signatures", () => {
  const executableSql = stripSqlComments(readMigration());
  for (const signature of functionSignatures) {
    const openingParen = signature.indexOf("(");
    const name = signature.slice(0, openingParen);
    const args = signature.slice(openingParen + 1, -1);
    assert.match(
      executableSql,
      new RegExp(
        "REVOKE EXECUTE ON FUNCTION public\\." +
          escapeRegExp(name) +
          "\\(" +
          escapeRegExp(args) +
          "\\) FROM PUBLIC, anon, authenticated;",
        "i",
      ),
    );
  }
  assert.equal(
    (executableSql.match(/REVOKE EXECUTE ON FUNCTION public\./gi) || [])
      .length,
    functionSignatures.length,
  );
  assert.doesNotMatch(executableSql, /REVOKE ALL PRIVILEGES ON FUNCTION/i);
});

test("migration hardens only the proven postgres public defaults", () => {
  const executableSql = stripSqlComments(readMigration());
  assert.equal((executableSql.match(/ALTER DEFAULT PRIVILEGES/gi) || []).length, 3);
  assert.match(
    executableSql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;/i,
  );
  assert.match(
    executableSql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;/i,
  );
  assert.match(
    executableSql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;/i,
  );
  assert.doesNotMatch(executableSql, /FOR ROLE supabase_admin/i);
  assert.doesNotMatch(executableSql, /IN SCHEMA (?:auth|storage|realtime)/i);
});

test("migration is ACL-only and preserves backend roles, schema usage, and RLS", () => {
  const executableSql = stripSqlComments(readMigration());
  assert.match(executableSql, /^BEGIN;\s*/i);
  assert.match(executableSql, /COMMIT;\s*$/i);
  assert.doesNotMatch(executableSql, /\bGRANT\b/i);
  assert.doesNotMatch(executableSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(
    executableSql,
    /\b(?:CREATE|DROP|ALTER)\s+(?:POLICY|ROLE|TABLE|VIEW|FUNCTION|TRIGGER|EVENT\s+TRIGGER)/i,
  );
  assert.doesNotMatch(
    executableSql,
    /\b(?:ENABLE|DISABLE|FORCE|NO\s+FORCE)\s+ROW LEVEL SECURITY\b/i,
  );
  assert.doesNotMatch(
    executableSql,
    /\b(?:ALTER|REASSIGN)\s+(?:TABLE|FUNCTION|VIEW)?\s*.*\bOWNER\b/i,
  );
  assert.doesNotMatch(executableSql, /\b(?:ALTER|DROP|CREATE)\s+SCHEMA\b/i);
  assert.doesNotMatch(executableSql, /\b(?:auth|storage|realtime)\s*\./i);
  assert.doesNotMatch(
    executableSql,
    /FROM\s+(?:PUBLIC,\s*)?(?:anon,\s*)?postgres\b/i,
  );
  assert.doesNotMatch(
    executableSql,
    /FROM\s+(?:PUBLIC,\s*)?(?:anon,\s*)?service_role\b/i,
  );
});

test("security-sensitive definitions remain outside the migration scope", () => {
  const executableSql = stripSqlComments(readMigration());
  assert.doesNotMatch(executableSql, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
  assert.doesNotMatch(executableSql, /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW/i);
  assert.doesNotMatch(executableSql, /(?:ALTER|DROP)\s+VIEW/i);
  assert.doesNotMatch(executableSql, /(?:ALTER|DROP)\s+FUNCTION/i);
  assert.doesNotMatch(executableSql, /(?:CREATE|ALTER|DROP)\s+(?:EVENT\s+)?TRIGGER/i);
  assert.doesNotMatch(executableSql, /\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i);
});
