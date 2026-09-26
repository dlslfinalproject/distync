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
  assert.match(capturedQuery, /s\.disaster_event_id = \$1/i);
  assert.match(
    capturedQuery,
    /WHERE el\.household_id = h\.id\s+AND el\.disaster_event_id = s\.disaster_event_id\s+ORDER BY\s+COALESCE\(el\.time_out, el\.time_in\) DESC,\s+el\.updated_at DESC,\s+el\.created_at DESC\s+LIMIT 1/i,
  );
  assert.doesNotMatch(
    capturedQuery,
    /queued_households\.barangay_id\s+IS\s+NOT\s+DISTINCT\s+FROM\s+h\.barangay_id/i,
  );
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

test("municipal Stub repository applies status, search, sector, and page filters in SQL", async () => {
  let capturedQuery = "";
  let capturedValues = [];

  pool.query = async (query, values) => {
    capturedQuery = query;
    capturedValues = values;
    return { rows: [{ id: "stub-2" }] };
  };

  const sectorId = "66666666-6666-4666-8666-666666666666";
  const rows = await stubRepository.getMunicipalStubDashboardRows(
    "event-1",
    ["barangay-1"],
    {
      status: "not_present",
      search: "family",
      sectorIds: [sectorId],
      sortOrder: "newest",
      limit: 25,
      offset: 25,
    },
  );

  assert.deepEqual(rows, [{ id: "stub-2" }]);
  assert.deepEqual(capturedValues, [
    "event-1",
    ["barangay-1"],
    [sectorId],
    "%family%",
    25,
    25,
  ]);
  assert.match(capturedQuery, /presentation_status/i);
  assert.match(capturedQuery, /IS DISTINCT FROM 'PRESENT'/i);
  assert.match(capturedQuery, /ILIKE \$4/i);
  assert.match(capturedQuery, /ANY\(\$3::uuid\[\]\)/i);
  assert.match(capturedQuery, /latest_attendance\.time_in DESC NULLS LAST/i);
  assert.match(capturedQuery, /LIMIT \$5\s+OFFSET \$6/i);
  assert.match(capturedQuery, /THEN 'NOT_PRESENT'/i);
});

test("municipal Stub repository keeps count and metrics on the same base scope", async () => {
  const capturedQueries = [];

  pool.query = async (query, values) => {
    capturedQueries.push({ query, values });
    return { rows: [{ total: 3, total_issued_stubs: 3 }] };
  };

  const barangayIds = ["barangay-1", "barangay-2"];
  const total = await stubRepository.countMunicipalStubDashboardRows(
    "event-1",
    barangayIds,
    { status: "claimed", search: "family" },
  );
  const metrics = await stubRepository.getMunicipalStubDashboardMetrics(
    "event-1",
    barangayIds,
  );

  assert.equal(total, 3);
  assert.equal(metrics.total_issued_stubs, 3);
  assert.equal(capturedQueries.length, 2);
  capturedQueries.forEach(({ query, values }) => {
    assert.deepEqual(values.slice(0, 2), ["event-1", barangayIds]);
    assert.match(query, /h\.barangay_id = ANY\(\$2::uuid\[\]\)/i);
    assert.match(query, /s\.status IN \('ISSUED', 'CLAIMED'\)/i);
  });
});
