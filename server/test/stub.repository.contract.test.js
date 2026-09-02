const assert = require("node:assert/strict");
const test = require("node:test");

const pool = require("../src/config/db");
const stubRepository = require("../src/repositories/stub.repository");

const originalPoolQuery = pool.query;

test.afterEach(() => {
  pool.query = originalPoolQuery;
});

test("member-sector lookup excludes inactive evacuees for relief-pack assignment", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  pool.query = async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [] };
  };

  const rows = await stubRepository.getMemberSectorsByHouseholdIds([
    "household-1",
  ]);

  assert.deepEqual(rows, []);
  assert.match(capturedQuery, /WHERE e\.household_id = ANY\(\$1::uuid\[\]\)/i);
  assert.match(capturedQuery, /AND e\.is_active = TRUE/i);
  assert.deepEqual(capturedValues, [["household-1"]]);
});
