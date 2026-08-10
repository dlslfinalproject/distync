const test = require("node:test");
const assert = require("node:assert/strict");

const forecastRepository = require("../src/repositories/forecast.repository");

const createCapturingDbClient = (rows = []) => {
  const calls = [];

  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows };
    },
  };
};

test("getReliefPackDemandByEvent forecasts only present unclaimed evacuation-center households with assigned packs", async () => {
  const dbClient = createCapturingDbClient([
    {
      inventory_item_id: "item-1",
      projected_household_demand: "12",
    },
  ]);

  const rows = await forecastRepository.getReliefPackDemandByEvent(
    "event-1",
    dbClient,
  );

  assert.equal(rows.length, 1);
  assert.equal(dbClient.calls.length, 1);

  const { sql, values } = dbClient.calls[0];

  assert.match(sql, /FROM households h/);
  assert.match(sql, /h\.current_stay_type = 'EVAC_CENTER'/);
  assert.match(sql, /h\.is_active = TRUE/);
  assert.match(sql, /s\.status = 'ISSUED'/);
  assert.match(sql, /latest_attendance\.status = 'PRESENT'/);
  assert.match(sql, /latest_attendance\.time_out IS NULL/);
  assert.match(sql, /rpt\.is_additional_pack = FALSE/);
  assert.match(sql, /household_sector_ids/);
  assert.match(sql, /rpt\.based_on_family_size = TRUE/);
  assert.match(sql, /SUBSTRING\(TRIM\(COALESCE\(rpt\.description, ''\)\) FROM '\^\[0-9\]\+'/);
  assert.match(sql, /CEIL\(eh\.household_size::numeric \/ family_size_coverage\.coverage\)/);
  assert.match(sql, /relief_pack_template_disaster_types/);
  assert.deepEqual(values[0], "event-1");
  assert.ok(values[1].includes("Typhoon"));
  assert.equal(values[2], "__relief_pack_sector_ids__:");
});

test("getForecastEventContext separates total, eligible, claimed, and unclaimed counts", async () => {
  const dbClient = createCapturingDbClient([
    {
      household_count: 4,
      active_inventory_item_count: 3,
      eligible_household_count: 2,
      claimed_household_count: 1,
      unclaimed_eligible_household_count: 1,
    },
  ]);

  const context = await forecastRepository.getForecastEventContext(
    "event-2",
    dbClient,
  );

  assert.equal(context.eligible_household_count, 2);
  assert.equal(context.active_inventory_item_count, 3);
  assert.equal(context.claimed_household_count, 1);
  assert.equal(context.unclaimed_eligible_household_count, 1);

  const { sql, values } = dbClient.calls[0];

  assert.match(sql, /eligible_household_count/);
  assert.match(sql, /claimed_household_count/);
  assert.match(sql, /unclaimed_eligible_household_count/);
  assert.match(sql, /active_inventory_item_count/);
  assert.match(sql, /dt\.distribution_status = 'CLAIMED'/);
  assert.deepEqual(values, ["event-2"]);
});
