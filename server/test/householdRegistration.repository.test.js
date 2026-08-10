const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryPath = path.resolve(
  __dirname,
  "../src/repositories/householdRegistration.repository.js",
);

test("BRG-SC-06-M01 household departure lock query locks the authoritative household row", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.match(
    source,
    /const getHouseholdSummaryByIdForUpdate = async \(id, dbClient\) => \{/,
  );
  assert.match(source, /FROM households h[\s\S]*WHERE h\.id = \$1[\s\S]*FOR UPDATE OF h/);
  assert.match(source, /getHouseholdSummaryByIdForUpdate,/);
});

test("EE-FIX-01 household registration scope lock projects authoritative event status", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.match(
    source,
    /const lockHouseholdRegistrationScope = async \(disasterEventId, dbClient\) => \{/,
  );
  assert.match(source, /SELECT[\s\S]*id,[\s\S]*status[\s\S]*FROM disaster_events/);
  assert.match(source, /WHERE id = \$1[\s\S]*FOR UPDATE/);
});
