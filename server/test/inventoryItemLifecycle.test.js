const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../..");
const schemaPath = path.join(repoRoot, "database/schema/distync_schema.sql");
const stockFormMigrationPath = path.join(
  repoRoot,
  "database/migrations/2026-07-26_add_inventory_item_stock_forms.sql",
);
const lifecycleMigrationPath = path.join(
  repoRoot,
  "database/migrations/2026-08-29_remove_inventory_item_lifecycle_status.sql",
);

test("inventory items are permanent records and stock forms keep their own status", () => {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const stockFormMigrationSql = fs.readFileSync(stockFormMigrationPath, "utf8");
  const lifecycleMigrationSql = fs.readFileSync(lifecycleMigrationPath, "utf8");

  const inventoryItemsTable = schemaSql.match(
    /CREATE TABLE public\.inventory_items \(([^]*?)\n\);/i,
  )?.[1];
  const stockFormsTable = schemaSql.match(
    /CREATE TABLE public\.inventory_item_stock_forms \(([^]*?)\n\);/i,
  )?.[1];

  assert.ok(inventoryItemsTable);
  assert.ok(stockFormsTable);
  assert.doesNotMatch(inventoryItemsTable, /\bis_active\b/i);
  assert.match(stockFormsTable, /\bis_active\s+boolean\s+NOT NULL\s+DEFAULT true/i);
  assert.doesNotMatch(stockFormMigrationSql, /ii\.is_active\b/i);
  assert.match(stockFormMigrationSql, /\bTRUE\b/);
  assert.match(
    lifecycleMigrationSql,
    /ALTER TABLE public\.inventory_items\s+DROP COLUMN IF EXISTS is_active/i,
  );
});
