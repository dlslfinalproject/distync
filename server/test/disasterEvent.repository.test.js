const assert = require("node:assert/strict");
const test = require("node:test");

const disasterEventRepository = require("../src/repositories/disasterEvent.repository");

test("duplicate disaster event title matching keeps the PostgreSQL whitespace regex escaped", async () => {
  let capturedQuery = "";
  const dbClient = {
    query: async (query) => {
      capturedQuery = query;
      return { rows: [] };
    },
  };

  await disasterEventRepository.findConflictingOpenDisasterEventByTitle({
    title: "Flood   Response",
    dbClient,
  });

  assert.equal(capturedQuery.includes("'\\s+'"), true);
  assert.equal(capturedQuery.includes("'s+'"), false);
});

test("disaster event barangay inserts de-duplicate mappings before writing", async () => {
  const capturedValues = [];
  const capturedQueries = [];
  const dbClient = {
    query: async (query, values) => {
      capturedQueries.push(query);
      capturedValues.push(values);
      return { rows: [{ id: values[1] }] };
    },
  };

  await disasterEventRepository.insertDisasterEventBarangays(
    "event-1",
    ["BRGY-A", "brgy-a", "BRGY-B", "BRGY-B"],
    dbClient,
  );

  assert.deepEqual(capturedValues, [
    ["event-1", "brgy-a"],
    ["event-1", "brgy-b"],
  ]);
  assert.equal(capturedQueries.length, 2);
  assert.match(capturedQueries[0], /ON CONFLICT DO NOTHING/);
});
