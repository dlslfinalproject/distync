const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const repositoryPath = path.join(
  __dirname,
  "../src/repositories/donation.repository.js",
);

const getPublicPortalDisasterSummarySource = async () => {
  const source = await fs.readFile(repositoryPath, "utf8");
  const startIndex = source.indexOf("const getPublicDonationDisasterSummaries");
  const endIndex = source.indexOf("const getPublicForecastSuggestions", startIndex);

  assert.notEqual(startIndex, -1);
  assert.notEqual(endIndex, -1);

  return source.slice(startIndex, endIndex);
};

test("public portal disaster summaries expose all active events for frontend current/recent selection", async () => {
  const source = await getPublicPortalDisasterSummarySource();

  assert.match(source, /UPPER\(de\.status\) IN \('ACTIVE', 'ONGOING'\)/);
  assert.doesNotMatch(source, /de\.start_date IS NULL OR de\.start_date <= CURRENT_DATE/);
  assert.doesNotMatch(source, /de\.end_date IS NULL OR de\.end_date >= CURRENT_DATE/);
  assert.doesNotMatch(source, /LIMIT 3/);
});

test("public portal disaster summaries use latest related operational activity per event", async () => {
  const source = await getPublicPortalDisasterSummarySource();

  assert.match(source, /activity_summary\.latest_activity_at/);
  assert.match(source, /FROM disaster_event_barangays deb/);
  assert.match(source, /FROM households h/);
  assert.match(source, /INNER JOIN evacuees e ON e\.household_id = h\.id/);
  assert.match(source, /FROM evacuation_logs el/);
  assert.match(source, /FROM stubs s/);
  assert.match(source, /FROM distribution_transactions dt/);
  assert.match(
    source,
    /GREATEST\(\s*COALESCE\(de\.updated_at, de\.created_at\),\s*COALESCE\(activity_summary\.latest_activity_at, de\.created_at\)\s*\) AS updated_at/,
  );
});

test("public portal disaster summary counts still come from authoritative event registration tables", async () => {
  const source = await getPublicPortalDisasterSummarySource();

  assert.match(source, /FROM disaster_event_barangays deb\s+INNER JOIN barangays b/);
  assert.match(source, /COUNT\(DISTINCT deb\.barangay_id\)::int AS affected_barangays_count/);
  assert.match(source, /COUNT\(DISTINCT h\.id\)::int AS registered_households_count/);
  assert.match(source, /COUNT\(DISTINCT e\.id\)::int AS affected_individuals_count/);
  assert.match(source, /h\.is_active = TRUE/);
  assert.match(source, /e\.is_active = TRUE/);
});

test("public portal family and individual totals accumulate evacuation-center records without departure filtering", async () => {
  const source = await getPublicPortalDisasterSummarySource();
  const householdSummaryStart = source.indexOf(
    "COUNT(DISTINCT h.id)::int AS registered_households_count",
  );
  const eligibleSummaryStart = source.indexOf(
    "COUNT(DISTINCT h.id)::int AS eligible_unclaimed_households_count",
  );
  const individualSummaryStart = source.indexOf(
    "COUNT(DISTINCT e.id)::int AS affected_individuals_count",
  );
  const activitySummaryStart = source.indexOf(
    "SELECT MAX(activity_at) AS latest_activity_at",
  );

  assert.notEqual(householdSummaryStart, -1);
  assert.notEqual(eligibleSummaryStart, -1);
  assert.notEqual(individualSummaryStart, -1);
  assert.notEqual(activitySummaryStart, -1);

  const householdSummary = source.slice(householdSummaryStart, eligibleSummaryStart);
  const individualSummary = source.slice(individualSummaryStart, activitySummaryStart);

  assert.match(householdSummary, /h\.current_stay_type = 'EVAC_CENTER'/);
  assert.match(individualSummary, /h\.current_stay_type = 'EVAC_CENTER'/);
  assert.match(householdSummary, /COUNT\(DISTINCT h\.id\)/);
  assert.match(individualSummary, /COUNT\(DISTINCT e\.id\)/);
  assert.doesNotMatch(householdSummary, /time_out IS NULL/);
  assert.doesNotMatch(individualSummary, /time_out IS NULL/);
  assert.doesNotMatch(householdSummary, /latest_attendance/);
  assert.doesNotMatch(individualSummary, /latest_attendance/);
});
