const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryPath = path.resolve(
  __dirname,
  "../src/repositories/masterlist.repository.js",
);

const readAnalyticsSource = () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  const analyticsSource = source.match(
    /const getMswdoMasterlistAnalytics = async \([\s\S]*?const getHouseholdsByFilters/,
  )?.[0];

  assert.ok(analyticsSource, "MSWDO analytics repository source is present");
  return analyticsSource;
};

test("MSWDO analytics uses database identity and explicit re-admission lineage", () => {
  const source = readAnalyticsSource();

  assert.match(source, /WITH RECURSIVE filtered_households/);
  assert.match(source, /h\.source_household_id/);
  assert.match(source, /household_lineage AS/);
  assert.match(source, /parent\.household_identity_id/);
  assert.match(source, /SELECT DISTINCT ON \(sh\.household_identity_id\)/);
  assert.match(source, /sh\.is_active DESC/);
  assert.match(source, /sh\.id DESC/);
  assert.doesNotMatch(source, /household_key|evacuee_key/);
});

test("MSWDO evacuation-center and daily admission charts use recorded log history", () => {
  const source = readAnalyticsSource();
  const centerSource = source.match(
    /evacuation_center_distribution AS \([\s\S]*?relief_distribution_per_barangay AS/,
  )?.[0];
  const dailySource = source.match(
    /daily_admission_trend AS \([\s\S]*?SELECT\s+summary\./,
  )?.[0];

  assert.ok(centerSource, "evacuation-center chart query is present");
  assert.ok(dailySource, "daily-admission chart query is present");

  for (const chartSource of [centerSource, dailySource]) {
    assert.match(chartSource, /FROM filtered_households fh/);
    assert.match(chartSource, /INNER JOIN evacuation_logs el/);
    assert.match(chartSource, /COUNT\(DISTINCT el\.evacuee_id\)/);
    assert.match(chartSource, /el\.disaster_event_id = \$1/);
  }

  assert.match(centerSource, /INNER JOIN evacuation_centers ec ON ec\.id = el\.evacuation_center_id/);
  assert.doesNotMatch(centerSource, /summary_evacuees_with_latest_log/);
});

test("re-admission lineage migration backfills only explicit audited links", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../database/migrations/2026-09-15_add_household_re_admission_lineage.sql",
  );
  const source = fs.readFileSync(migrationPath, "utf8");

  assert.match(source, /ADD COLUMN IF NOT EXISTS source_household_id uuid/);
  assert.match(source, /HOUSEHOLD_RE_ADMITTED/);
  assert.match(source, /HOUSEHOLD_RETURN_TO_EVAC_CENTER/);
  assert.match(source, /successor\.disaster_event_id = source\.disaster_event_id/);
  assert.match(source, /successor\.barangay_id = source\.barangay_id/);
  assert.match(source, /Do not infer links from names/);
});
