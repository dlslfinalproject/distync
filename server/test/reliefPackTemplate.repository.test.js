const assert = require("node:assert/strict");
const test = require("node:test");

const pool = require("../src/config/db");
const distributionTransactionRepository = require("../src/repositories/distributionTransaction.repository");
const reliefPackTemplateRepository = require("../src/repositories/reliefPackTemplate.repository");

const originalPoolQuery = pool.query;

test.afterEach(() => {
  pool.query = originalPoolQuery;
});

test("getReliefPackTemplateByName searches all statuses using normalized names", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  pool.query = async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [{ id: "template-1", name: "Food Pack" }] };
  };

  const result = await reliefPackTemplateRepository.getReliefPackTemplateByName(
    "  food pack  ",
  );

  assert.deepEqual(result, { id: "template-1", name: "Food Pack" });
  assert.deepEqual(capturedValues, ["  food pack  "]);
  assert.match(capturedQuery, /LOWER\(BTRIM\(name\)\)\s*=\s*LOWER\(BTRIM\(\$1\)\)/i);
  assert.match(capturedQuery, /ORDER BY is_active DESC, updated_at DESC/i);
  assert.doesNotMatch(capturedQuery, /is_active\s*=\s*TRUE/i);
});

test("updateReliefPackTemplateStatus changes only the lifecycle status", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const dbClient = {
    query: async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return { rows: [{ id: "template-1", is_active: true }] };
    },
  };

  const result =
    await reliefPackTemplateRepository.updateReliefPackTemplateStatus(
      "template-1",
      true,
      dbClient,
    );

  assert.deepEqual(result, { id: "template-1", is_active: true });
  assert.match(capturedQuery, /SET is_active = \$2/i);
  assert.match(capturedQuery, /updated_at = NOW\(\)/i);
  assert.deepEqual(capturedValues, ["template-1", true]);
});

test("insertDistributionTransactionReliefPackTemplates links each unique template once", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const dbClient = {
    query: async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return {
        rows: [
          {
            distribution_transaction_id: "distribution-1",
            relief_pack_template_id: "template-1",
          },
        ],
      };
    },
  };

  const result =
    await distributionTransactionRepository.insertDistributionTransactionReliefPackTemplates(
      "distribution-1",
      [
        { id: "template-1", name: "Food Pack" },
        { id: "template-2", name: "Hygiene Kit" },
        { id: "template-1", name: "Food Pack" },
        null,
      ],
      dbClient,
    );

  assert.equal(result.length, 1);
  assert.match(
    capturedQuery,
    /distribution_transaction_relief_pack_templates/i,
  );
  assert.match(capturedQuery, /UNNEST\(\$2::uuid\[\],\s*\$3::text\[\]\)/i);
  assert.match(capturedQuery, /name_snapshot/i);
  assert.match(capturedQuery, /ON CONFLICT\s*\(distribution_transaction_id,\s*relief_pack_template_id\)/i);
  assert.deepEqual(capturedValues, [
    "distribution-1",
    ["template-1", "template-2"],
    ["Food Pack", "Hygiene Kit"],
  ]);
});

test("insertDistributionTransactionItem persists immutable released-item labels", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const dbClient = {
    query: async (query, values) => {
      capturedQuery = query;
      capturedValues = values;
      return {
        rows: [
          {
            id: "distribution-item-1",
            item_name_snapshot: "Rice",
          },
        ],
      };
    },
  };

  const result = await distributionTransactionRepository.insertDistributionTransactionItem(
    {
      distribution_transaction_id: "distribution-1",
      inventory_batch_id: "batch-1",
      inventory_item_id: "item-1",
      quantity_released: 2,
      item_code_snapshot: "RICE-001",
      item_name_snapshot: "Rice",
      unit_of_measure_snapshot: "sack",
    },
    dbClient,
  );

  assert.equal(result.id, "distribution-item-1");
  assert.match(capturedQuery, /item_code_snapshot/i);
  assert.match(capturedQuery, /item_name_snapshot/i);
  assert.match(capturedQuery, /unit_of_measure_snapshot/i);
  assert.deepEqual(capturedValues, [
    "distribution-1",
    "batch-1",
    "item-1",
    2,
    "RICE-001",
    "Rice",
    "sack",
  ]);
});

test("relief pack usage counts legacy and linked secondary templates", async () => {
  let capturedQuery = "";

  pool.query = async (query) => {
    capturedQuery = query;
    return { rows: [] };
  };

  await reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId(
    "template-2",
  );

  assert.match(capturedQuery, /dt\.relief_pack_template_id\s*=\s*\$1/i);
  assert.match(
    capturedQuery,
    /EXISTS\s*\(\s*SELECT 1[\s\S]*distribution_transaction_relief_pack_templates/i,
  );
  assert.match(
    capturedQuery,
    /dtrpt\.relief_pack_template_id\s*=\s*\$1/i,
  );
  assert.match(capturedQuery, /COUNT\(dt\.id\)\s+FILTER/i);
  assert.match(capturedQuery, /active_event_distributions_count/i);
  assert.match(capturedQuery, /edit_blocking_distributions_count/i);
});

test("relief pack deactivation blockers include active events and unsynced linked distributions", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  pool.query = async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return {
      rows: [
        {
          active_event_distribution_count: 1,
          unsynced_distribution_count: 1,
        },
      ],
    };
  };

  const result =
    await reliefPackTemplateRepository.getReliefPackTemplateDeactivationBlockersByTemplateId(
      "template-2",
    );

  assert.deepEqual(result, {
    active_event_distribution_count: 1,
    unsynced_distribution_count: 1,
  });
  assert.deepEqual(capturedValues, ["template-2"]);
  assert.match(capturedQuery, /distribution_status\s*=\s*'CLAIMED'/i);
  assert.match(capturedQuery, /NOT IN\s*\('CLOSED',\s*'ARCHIVED'\)/i);
  assert.match(capturedQuery, /sync_status/i);
  assert.match(
    capturedQuery,
    /EXISTS\s*\(\s*SELECT 1[\s\S]*distribution_transaction_relief_pack_templates/i,
  );
  assert.match(
    capturedQuery,
    /dtrpt\.relief_pack_template_id\s*=\s*\$1/i,
  );
});
