const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const basisModulePath = require.resolve("../src/utils/inventoryStateBasis");
const repoRoot = path.resolve(__dirname, "../..");

const batch = {
  id: "11111111-1111-4111-8111-111111111111",
  inventory_item_id: "22222222-2222-4222-8222-222222222222",
  stock_version: 3,
  quantity_available: 12,
  status: "AVAILABLE",
  expiration_date: "2026-12-31",
};

const withBasisEnvironment = (env, runTest) => {
  const previousValues = {};

  for (const key of [
    "INVENTORY_STATE_BASIS_SECRET",
    "JWT_SECRET",
    "SUPABASE_JWT_SECRET",
  ]) {
    previousValues[key] = process.env[key];
    delete process.env[key];
  }

  Object.assign(process.env, env);
  delete require.cache[basisModulePath];

  try {
    return runTest(require(basisModulePath));
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    delete require.cache[basisModulePath];
  }
};

test("HARD-B01 and HARD-B05 dedicated inventory basis secret signs and verifies", () => {
  withBasisEnvironment(
    {
      INVENTORY_STATE_BASIS_SECRET: "unit-test-inventory-state-basis-secret",
      JWT_SECRET: "different-unit-test-jwt-secret",
    },
    ({
      BASIS_VERSION,
      createInventoryStateBasis,
      verifyInventoryStateBasis,
    }) => {
      const basis = createInventoryStateBasis(
        batch,
        "2026-08-09T01:02:03.000Z",
      );

      assert.equal(basis.basisVersion, BASIS_VERSION);
      assert.equal(basis.inventoryBatchId, batch.id);
      assert.equal(basis.inventoryItemId, batch.inventory_item_id);
      assert.equal(basis.stockVersion, 3);
      assert.equal(basis.quantityAvailable, 12);
      assert.equal(basis.status, "AVAILABLE");
      assert.equal(basis.expirationDate, "2026-12-31");
      assert.equal(typeof basis.token, "string");

      const verification = verifyInventoryStateBasis(basis);

      assert.equal(verification.valid, true);
      assert.deepEqual(verification.basis, {
        basisVersion: BASIS_VERSION,
        inventoryBatchId: batch.id,
        inventoryItemId: batch.inventory_item_id,
        stockVersion: 3,
        quantityAvailable: 12,
        status: "AVAILABLE",
        expirationDate: "2026-12-31",
        observedServerAt: "2026-08-09T01:02:03.000Z",
      });
    },
  );
});

test("HARD-B02, HARD-B03, and HARD-B04 missing inventory basis secret fails closed without JWT fallback", () => {
  withBasisEnvironment(
    {
      JWT_SECRET: "unit-test-jwt-secret-must-not-be-used",
      SUPABASE_JWT_SECRET: "unit-test-supabase-jwt-secret-must-not-be-used",
    },
    ({ createInventoryStateBasis, verifyInventoryStateBasis }) => {
      assert.throws(
        () => createInventoryStateBasis(batch, "2026-08-09T01:02:03.000Z"),
        {
          code: "INVENTORY_STATE_BASIS_SECRET_MISSING",
          statusCode: 500,
        },
      );

      assert.throws(
        () =>
          verifyInventoryStateBasis({
            basisVersion: 1,
            inventoryBatchId: batch.id,
            inventoryItemId: batch.inventory_item_id,
            stockVersion: 3,
            quantityAvailable: 12,
            status: "AVAILABLE",
            expirationDate: "2026-12-31",
            observedServerAt: "2026-08-09T01:02:03.000Z",
            token: "invalid",
          }),
        {
          code: "INVENTORY_STATE_BASIS_SECRET_MISSING",
          statusCode: 500,
        },
      );
    },
  );
});

test("HARD-B06 through HARD-B08 inventory state basis rejects tampered values", () => {
  withBasisEnvironment(
    { INVENTORY_STATE_BASIS_SECRET: "unit-test-inventory-state-basis-secret" },
    ({ createInventoryStateBasis, verifyInventoryStateBasis }) => {
      const basis = createInventoryStateBasis(
        batch,
        "2026-08-09T01:02:03.000Z",
      );

      for (const tamperedBasis of [
        { ...basis, quantityAvailable: 13 },
        { ...basis, stockVersion: 4 },
        {
          ...basis,
          inventoryBatchId: "33333333-3333-4333-8333-333333333333",
        },
      ]) {
        assert.equal(verifyInventoryStateBasis(tamperedBasis).valid, false);
      }
    },
  );
});

test("inventory basis signing remains deterministic and has no short duration field", () => {
  withBasisEnvironment(
    { INVENTORY_STATE_BASIS_SECRET: "unit-test-inventory-state-basis-secret" },
    ({ createInventoryStateBasis, buildSignedPayload }) => {
      const basis = createInventoryStateBasis(
        batch,
        "2026-08-09T01:02:03.000Z",
      );

      assert.equal(buildSignedPayload(basis), buildSignedPayload({ ...basis }));
      assert.equal("expiresAt" in basis, false);
    },
  );
});

test("HARD-A01 through HARD-A12 stock version migration owns value-change semantics statically", () => {
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-09_add_inventory_batch_stock_version.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );
  const triggerFunctionMatch = migrationSql.match(
    /CREATE OR REPLACE FUNCTION public\.increment_inventory_batch_stock_version\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/,
  );

  assert.ok(triggerFunctionMatch, "stock-version trigger function exists");
  const triggerFunctionSql = triggerFunctionMatch[0];

  assert.match(
    migrationSql,
    /ADD COLUMN IF NOT EXISTS stock_version integer NOT NULL DEFAULT 0/,
  );
  assert.match(migrationSql, /CREATE TRIGGER inventory_batches_stock_version_before_update/);
  assert.match(migrationSql, /BEFORE UPDATE\s+ON public\.inventory_batches/);
  assert.doesNotMatch(
    migrationSql,
    /BEFORE UPDATE OF quantity_available, status, expiration_date/,
  );
  assert.match(triggerFunctionSql, /OLD\.quantity_available IS DISTINCT FROM NEW\.quantity_available|NEW\.quantity_available IS DISTINCT FROM OLD\.quantity_available/);
  assert.match(triggerFunctionSql, /OLD\.status IS DISTINCT FROM NEW\.status|NEW\.status IS DISTINCT FROM OLD\.status/);
  assert.match(triggerFunctionSql, /OLD\.expiration_date IS DISTINCT FROM NEW\.expiration_date|NEW\.expiration_date IS DISTINCT FROM OLD\.expiration_date/);
  assert.match(triggerFunctionSql, /NEW\.stock_version := OLD\.stock_version \+ 1/);
  assert.match(triggerFunctionSql, /ELSE\s+NEW\.stock_version := OLD\.stock_version;/);
  assert.doesNotMatch(triggerFunctionSql, /UPDATE\s+(public\.)?inventory_batches/i);
  assert.match(schemaSql, /stock_version integer NOT NULL DEFAULT 0/);
  assert.match(schemaSql, /BEFORE UPDATE\s+ON public\.inventory_batches/);

  const stockWriterFiles = [
    "server/src/repositories/inventoryTransaction.repository.js",
    "server/src/repositories/distributionTransaction.repository.js",
    "server/src/repositories/donation.repository.js",
    "server/src/repositories/inventoryBatch.repository.js",
  ];

  for (const relativePath of stockWriterFiles) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

    assert.doesNotMatch(
      source,
      /SET[\s\S]{0,300}stock_version\s*=/i,
      `${relativePath} must not set stock_version in UPDATE statements`,
    );
    assert.doesNotMatch(
      source,
      /stock_version\s*=\s*stock_version\s*\+/i,
      `${relativePath} must not independently increment stock_version`,
    );
  }
});

test("HARD-B09 and HARD-B10 tracked files do not expose a real basis secret to source or frontend", () => {
  const envExample = fs.readFileSync(
    path.join(repoRoot, "server/.env.example"),
    "utf8",
  );
  const clientSourceFiles = fs
    .readdirSync(path.join(repoRoot, "client/src"), { recursive: true })
    .filter((fileName) => /\.(js|jsx|ts|tsx|env|json)$/i.test(fileName))
    .map((fileName) => path.join(repoRoot, "client/src", fileName));

  assert.match(
    envExample,
    /INVENTORY_STATE_BASIS_SECRET=replace-with-strong-random-server-secret/,
  );

  for (const filePath of clientSourceFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /INVENTORY_STATE_BASIS_SECRET/);
  }
});
