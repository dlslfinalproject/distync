const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "..",
  "..",
  "database",
  "migrations",
  "2026-09-03_remove_distribution_transaction_lifecycle_status.sql",
);
const schemaPath = path.join(
  __dirname,
  "..",
  "..",
  "database",
  "schema",
  "distync_schema.sql",
);

test("distribution lifecycle cleanup keeps only final CLAIMED status", () => {
  const migration = fs.readFileSync(migrationPath, "utf8");
  const schema = fs.readFileSync(schemaPath, "utf8");

  assert.match(migration, /^BEGIN;\s*/i);
  assert.match(
    migration,
    /LOCK TABLE public\.distribution_transactions IN ACCESS EXCLUSIVE MODE/i,
  );
  assert.match(migration, /non_claimed_count/i);
  assert.match(migration, /IS DISTINCT FROM 'CLAIMED'/i);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS chk_distribution_status/i);
  assert.match(
    migration,
    /ADD CONSTRAINT chk_distribution_status[\s\S]*CHECK \(distribution_status = 'CLAIMED'\)/i,
  );
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
  assert.match(migration, /COMMIT;\s*$/i);
  assert.match(
    schema,
    /distribution_status character varying NOT NULL DEFAULT 'CLAIMED'::character varying CHECK \(distribution_status::text = 'CLAIMED'::text\)/i,
  );
});

test("distribution lifecycle endpoint and implementation are removed", () => {
  const routeSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "routes",
      "distributionTransaction.routes.js",
    ),
    "utf8",
  );
  const validatorSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "validators",
      "distributionTransaction.validator.js",
    ),
    "utf8",
  );
  const serviceSource = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "services",
      "distributionTransaction.service.js",
    ),
    "utf8",
  );

  assert.doesNotMatch(routeSource, /distributionTransactionLifecycle|\/lifecycle/i);
  assert.doesNotMatch(validatorSource, /validateUpdateDistributionLifecycle|REVERSED/i);
  assert.doesNotMatch(serviceSource, /updateDistributionTransactionLifecycle|DISTRIBUTION_REVERSE|DISTRIBUTION_CANCEL/i);
});
