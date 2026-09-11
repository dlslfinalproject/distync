const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);
const seedPath = path.join(
  repositoryRoot,
  "database",
  "seeds",
  "inventory_clean_starter_seed.sql",
);
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-11_remove_inventory_item_expiration_date.sql",
);

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const stripSqlComments = (sql) =>
  sql.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const getTableBlock = (schema, tableName) =>
  schema.match(
    new RegExp(`CREATE TABLE public\\.${tableName} \\(([\\s\\S]*?)\\r?\\n\\);`),
  )?.[1];

test("canonical schema retires item expiration while preserving batch expiration", () => {
  const schema = read(schemaPath);
  const itemTable = getTableBlock(schema, "inventory_items");
  const batchTable = getTableBlock(schema, "inventory_batches");

  assert.ok(itemTable, "inventory_items schema block should exist");
  assert.ok(batchTable, "inventory_batches schema block should exist");
  assert.doesNotMatch(itemTable, /expiration_date/i);
  assert.match(batchTable, /expiration_date date,/i);
  assert.match(
    schema,
    /CREATE TRIGGER inventory_batches_stock_version_before_update[\s\S]*?increment_inventory_batch_stock_version/i,
  );
});

test("forward migration drops exactly the retired parent column", () => {
  assert.equal(fs.existsSync(migrationPath), true);

  const migration = read(migrationPath);
  const executableSql = stripSqlComments(migration);

  assert.match(migration, /^BEGIN;\s*/i);
  assert.match(migration, /COMMIT;\s*$/i);
  assert.match(
    executableSql,
    /ALTER TABLE public\.inventory_items\s+DROP COLUMN expiration_date\s*;/i,
  );
  assert.equal((executableSql.match(/ALTER TABLE/g) || []).length, 1);
  assert.equal((executableSql.match(/DROP COLUMN/g) || []).length, 1);
  assert.doesNotMatch(executableSql, /IF EXISTS|CASCADE/i);
  assert.doesNotMatch(executableSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(executableSql, /inventory_batches/i);
});

test("clean starter seed keeps expiration as transient input and writes it to opening batches", () => {
  const seed = read(seedPath);

  assert.match(seed, /reorder_level,\s*expiration_date\s*\n\s*\)\s*\n\s*\),/i);
  const insertedItemBlock = seed.match(
    /inserted_items AS \(([\s\S]*?)RETURNING id, item_code/i,
  )?.[1];

  assert.ok(insertedItemBlock, "inserted_items CTE should exist");
  assert.match(
    insertedItemBlock,
    /INSERT INTO inventory_items \([\s\S]*?reorder_level\s*\n\s*\)\s*\n\s*SELECT[\s\S]*?reorder_level\s*\n\s*FROM seed_items/i,
  );
  assert.doesNotMatch(insertedItemBlock, /expiration_date/i);
  assert.doesNotMatch(seed, /EXCLUDED\.expiration_date/i);
  assert.match(seed, /si\.expiration_date\s+AS expiration_date/i);
  assert.match(
    seed,
    /FROM inserted_items ii\s+INNER JOIN seed_items si\s+ON si\.item_code = ii\.item_code/i,
  );
});
