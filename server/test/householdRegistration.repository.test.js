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

test("HH-ATT-001 lifecycle dependency probe covers operational child records", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  const dependencySource = source.match(
    /const getHouseholdLifecycleDependencies = async \([\s\S]*?const getActiveHouseholdSuccessorById/,
  )?.[0];

  assert.ok(dependencySource, "lifecycle dependency probe is present");
  for (const tableName of [
    "evacuees",
    "evacuation_logs",
    "household_privacy_consents",
    "household_sectors",
    "evacuee_sectors",
    "stubs",
    "stub_donated_relief_pack_assignments",
    "distribution_transactions",
  ]) {
    assert.match(dependencySource, new RegExp(`FROM ${tableName}`));
  }
  assert.match(dependencySource, /has_open_attendance/);
  assert.match(dependencySource, /has_reserved_assignments/);
  assert.match(source, /getHouseholdLifecycleDependencies,/);
});

test("HH-ATT-002 correction update only targets current open attendance and preserves time order", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const correctionSource = source.match(
    /const updateEvacuationLogCorrection = async \([\s\S]*?const archiveHousehold/,
  )?.[0];

  assert.ok(correctionSource, "attendance correction update is present");
  assert.match(correctionSource, /status = 'PRESENT'/);
  assert.match(correctionSource, /time_out IS NULL/);
  assert.match(correctionSource, /GREATEST\(NOW\(\), time_in\)/);
});

test("HH-ATT-002 no repository operation remains for rewriting closed departure timestamps", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.doesNotMatch(source, /updateHouseholdDepartureTimestamp/);
  assert.match(
    source,
    /const getEvacuationLogByIdForHouseholdForUpdate = async \([\s\S]*?FOR UPDATE/,
  );
  assert.match(source, /getEvacuationLogByIdForHouseholdForUpdate,/);
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

test("EE-FIX-02 household update summaries project authoritative disaster event status", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");

  assert.match(
    source,
    /const getHouseholdSummaryById = async \(id, dbClient = pool\) => \{[\s\S]*de\.status AS disaster_event_status/,
  );
  assert.match(
    source,
    /const getHouseholdSummaryByIdForUpdate = async \(id, dbClient\) => \{[\s\S]*de\.status AS disaster_event_status/,
  );
});

test("historical household update queries only target active occurrences", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const updateSource = source.match(
    /const updateHousehold = async \([\s\S]*?const insertEvacuee = async/,
  )?.[0];

  assert.ok(updateSource, "updateHousehold source is present");
  assert.match(updateSource, /WHERE id = \$1[\s\S]*AND is_active = TRUE/);
});

test("offline registration timestamp reconciliation cannot rewrite archived attendance", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const updateSource = source.match(
    /const updateHouseholdRegistrationTimestamp = async \([\s\S]*?const updateHousehold = async/,
  )?.[0];

  assert.ok(updateSource, "timestamp reconciliation source is present");
  assert.match(updateSource, /UPDATE households[\s\S]*WHERE id = \$1[\s\S]*AND is_active = TRUE/);
  assert.match(
    updateSource,
    /UPDATE evacuation_logs[\s\S]*WHERE household_id IN \(SELECT id FROM updated_household\)/,
  );
});

test("re-admission successor detection only treats a later active occurrence as already admitted", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const match = source.match(
    /const getActiveHouseholdSuccessorById = async \([\s\S]*?const markHouseholdDeparture/,
  );

  assert.ok(match, "active successor query is present");
  const successorSource = match[0];

  assert.match(successorSource, /source\.is_active = FALSE/);
  assert.match(successorSource, /successor\.is_active = TRUE/);
  assert.match(successorSource, /successor\.disaster_event_id = source\.disaster_event_id/);
  assert.match(successorSource, /successor\.barangay_id = source\.barangay_id/);
  assert.match(successorSource, /successor\.registered_at > source\.registered_at/);
  assert.match(successorSource, /active_log\.status = 'PRESENT'/);
  assert.match(successorSource, /active_log\.time_out IS NULL/);
});

test("active cross-event family-head lookup surfaces active registrations without presence filtering", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const match = source.match(
    /const findActiveCrossEventFamilyHeadMatches = async \([\s\S]*?const updateHouseholdRegistrationTimestamp/,
  );

  assert.ok(match, "findActiveCrossEventFamilyHeadMatches source is present");

  const lookupSource = match[0];

  assert.match(lookupSource, /de\.status = 'ACTIVE'/);
  assert.match(lookupSource, /h\.disaster_event_id <> \$1/);
  assert.match(lookupSource, /h\.is_active = TRUE/);
  assert.doesNotMatch(lookupSource, /latest_attendance/);
  assert.doesNotMatch(lookupSource, /evacuation_logs/);
  assert.doesNotMatch(lookupSource, /time_out/);
  assert.doesNotMatch(lookupSource, /<> 'LEFT'|!= 'LEFT'/);
});
