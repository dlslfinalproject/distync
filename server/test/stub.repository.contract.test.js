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

test("Stage 5 municipal Stub repository is one set-wise query with per-Barangay ordering", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  let queryCount = 0;

  pool.query = async (query, values) => {
    queryCount += 1;
    capturedQuery = query;
    capturedValues = values;
    return {
      rows: [
        {
          id: "stub-1",
          barangay_id: "barangay-1",
          stub_sequence_no: 1,
        },
      ],
    };
  };

  const barangayIds = [
    "barangay-1",
    "barangay-2",
    "barangay-3",
    "barangay-4",
    "barangay-5",
  ];
  const rows = await stubRepository.getMunicipalStubDashboardRows(
    "event-1",
    barangayIds,
  );

  assert.equal(rows.length, 1);
  assert.equal(queryCount, 1);
  assert.deepEqual(capturedValues, ["event-1", barangayIds]);
  assert.match(capturedQuery, /h\.barangay_id = ANY\(\$2::uuid\[\]\)/i);
  assert.match(capturedQuery, /b\.name ASC/i);
  assert.match(capturedQuery, /b\.id ASC/i);
  assert.match(capturedQuery, /CASE WHEN h\.is_active = FALSE THEN 1 ELSE 0 END/i);
  assert.match(capturedQuery, /latest_attendance\.time_in ASC NULLS LAST/i);
  assert.match(capturedQuery, /s\.issued_at ASC/i);
  assert.match(capturedQuery, /s\.id ASC/i);
  assert.match(capturedQuery, /s\.status IN \('ISSUED', 'CLAIMED'\)/i);
  assert.match(capturedQuery, /PARTITION|sequence_stubs\.disaster_event_id/i);
});

test("Stage 5 municipal Stub repository short-circuits an empty authoritative scope", async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    return { rows: [] };
  };

  const rows = await stubRepository.getMunicipalStubDashboardRows("event-1", []);

  assert.deepEqual(rows, []);
  assert.equal(queryCount, 0);
});
