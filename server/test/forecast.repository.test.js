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

test("getInventoryForecastItems totals only eligible LGU stock and event-scoped donated stock", async () => {
  const dbClient = createCapturingDbClient([
    {
      id: "item-1",
      current_available_stock: "25",
      current_lgu_available_stock: "15",
      current_donated_available_stock: "10",
    },
  ]);

  const rows = await forecastRepository.getInventoryForecastItems(
    "event-1",
    dbClient,
  );

  assert.equal(rows.length, 1);
  assert.equal(dbClient.calls.length, 1);

  const { sql, values } = dbClient.calls[0];

  assert.match(sql, /COALESCE\(SUM\(ib\.quantity_available\), 0\) AS current_available_stock/);
  assert.match(sql, /ib\.status IN \('AVAILABLE', 'LOW_STOCK'\)/);
  assert.match(sql, /COALESCE\(ib\.quantity_available, 0\) > 0/);
  assert.match(
    sql,
    /ib\.expiration_date IS NULL\s+OR ib\.expiration_date > \(CURRENT_DATE \+ INTERVAL '30 days'\)/,
  );
  assert.match(sql, /ib\.source_type = 'LGU'/);
  assert.match(sql, /ib\.source_type = 'DONATED'/);
  assert.match(sql, /LEFT JOIN disaster_events target_event\s+ON target_event\.id = \$1/);
  assert.match(sql, /relief_pack_donation_items\.inventory_batch_id = ib\.id/);
  assert.match(sql, /relief_pack_donation_items\.remarks.*ILIKE 'Relief Pack:%'/);
  assert.match(sql, /d\.disaster_event_id = target_event\.id/);
  assert.match(sql, /COALESCE\(di\.remarks, ''\) NOT ILIKE 'Relief Pack:%'/);
  assert.match(sql, /donation_event\.status\s*=\s*'CLOSED'/);
  assert.match(sql, /FROM disaster_events next_event/);
  assert.match(sql, /next_event\.status = 'ACTIVE'/);
  assert.match(sql, /target_event\.created_at > donation_event\.created_at/);
  assert.match(sql, /target_event\.status = 'ACTIVE'/);
  assert.match(sql, /\(\$1::UUID IS NULL OR target_event\.status = 'ACTIVE'\)/);
  assert.match(sql, /d\.status <> 'CANCELLED'/);
  assert.match(sql, /current_lgu_available_stock/);
  assert.match(sql, /current_donated_available_stock/);
  assert.deepEqual(values, ["event-1"]);
});

test("getEligibleInventoryUsageSeries uses explicit event-scoped Manila day bounds", async () => {
  const dbClient = createCapturingDbClient([
    {
      inventory_item_id: "item-1",
      usage_date: "2026-09-30",
      total_quantity: "5",
    },
  ]);

  const rows = await forecastRepository.getEligibleInventoryUsageSeries(
    "event-1",
    "2026-09-20",
    "2026-09-29",
    dbClient,
  );

  assert.equal(rows.length, 1);
  assert.equal(dbClient.calls.length, 1);

  const { sql, values } = dbClient.calls[0];
  assert.match(sql, /it\.disaster_event_id = \$1/);
  assert.match(sql, /it\.transaction_type = 'OUTFLOW'/);
  assert.match(sql, /it\.reference_type = 'DISTRIBUTION'/);
  assert.match(
    sql,
    /\(it\.performed_at AT TIME ZONE 'Asia\/Manila'\)::date AS usage_date/,
  );
  assert.match(
    sql,
    /it\.performed_at >= \(\(\$2::date\)::timestamp AT TIME ZONE 'Asia\/Manila'\)/,
  );
  assert.match(
    sql,
    /it\.performed_at < \(\(\(\$3::date \+ 1\)::timestamp\) AT TIME ZONE 'Asia\/Manila'\)/,
  );
  assert.match(
    sql,
    /GROUP BY ii\.id, \(it\.performed_at AT TIME ZONE 'Asia\/Manila'\)::date/,
  );
  assert.doesNotMatch(sql, /CURRENT_DATE|DATE\(it\.performed_at\)/);
  assert.deepEqual(values, ["event-1", "2026-09-20", "2026-09-29"]);
});

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
      inventory_item_count: 3,
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
  assert.equal(context.inventory_item_count, 3);
  assert.equal(context.claimed_household_count, 1);
  assert.equal(context.unclaimed_eligible_household_count, 1);

  const { sql, values } = dbClient.calls[0];

  assert.match(sql, /eligible_household_count/);
  assert.match(sql, /claimed_household_count/);
  assert.match(sql, /unclaimed_eligible_household_count/);
  assert.match(sql, /inventory_item_count/);
  assert.doesNotMatch(sql, /active_inventory_item_count/);
  assert.doesNotMatch(
    sql,
    /FROM inventory_items\s+WHERE\s+is_active\s*=\s*TRUE/i,
  );
  assert.match(sql, /dt\.distribution_status = 'CLAIMED'/);
  assert.deepEqual(values, ["event-2"]);
});

test("getLatestForecastRun returns the newest forecast without disaster event filtering", async () => {
  const dbClient = createCapturingDbClient([
    {
      id: "forecast-run-1",
      disaster_event_id: "event-1",
      run_at: "2026-08-16T08:00:00.000Z",
    },
  ]);

  const latestRun = await forecastRepository.getLatestForecastRun(dbClient);

  assert.equal(latestRun.id, "forecast-run-1");
  assert.equal(dbClient.calls.length, 1);

  const { sql, values } = dbClient.calls[0];

  assert.match(sql, /FROM forecast_runs fr/);
  assert.match(sql, /fr\.selection_mode/);
  assert.match(sql, /INNER JOIN disaster_events de ON de\.id = fr\.disaster_event_id/);
  assert.match(sql, /ORDER BY fr\.run_at DESC, fr\.id DESC/);
  assert.doesNotMatch(sql, /WHERE fr\.disaster_event_id = \$1/);
  assert.equal(values, undefined);
});

test("insertForecastRun stores AUTO mode with a null run model and defaults old callers to fixed", async () => {
  const parametersJson = {
    selection_mode: "AUTO_BACKTEST",
    evaluation_method: "ROLLING_ORIGIN_ONE_STEP",
  };
  const autoDb = createCapturingDbClient([{ id: "run-auto" }]);

  await forecastRepository.insertForecastRun(
    {
      disaster_event_id: "event-1",
      run_type: "INVENTORY_DEMAND",
      run_by: "user-1",
      selection_mode: "AUTO_BACKTEST",
      model_name: null,
      parameters_json: parametersJson,
    },
    autoDb,
  );

  assert.equal(autoDb.calls.length, 1);
  assert.match(autoDb.calls[0].sql, /selection_mode/);
  assert.deepEqual(autoDb.calls[0].values, [
    "AUTO_BACKTEST",
    "event-1",
    "INVENTORY_DEMAND",
    "user-1",
    null,
    parametersJson,
  ]);

  const fixedDb = createCapturingDbClient([{ id: "run-fixed" }]);
  await forecastRepository.insertForecastRun(
    {
      disaster_event_id: "event-1",
      run_type: "INVENTORY_DEMAND",
      run_by: "user-1",
      model_name: "MOVING_AVERAGE",
      parameters_json: { model_name: "MOVING_AVERAGE" },
    },
    fixedDb,
  );
  assert.equal(fixedDb.calls[0].values[0], "FIXED_MODEL");
  assert.equal(fixedDb.calls[0].values[4], "MOVING_AVERAGE");
});

test("insertForecastResult stores item selection and JSONB while old callers retain nulls", async () => {
  const modelEvaluation = {
    version: 1,
    recommended_model: "TREND_PROJECTION",
    selected_model: "TREND_PROJECTION",
    candidates: [
      { model_name: "MOVING_AVERAGE", mae: 1, rmse: 2 },
      { model_name: "EXPONENTIAL_SMOOTHING", mae: 2, rmse: 3 },
      { model_name: "TREND_PROJECTION", mae: 0.5, rmse: 1 },
    ],
  };
  const autoDb = createCapturingDbClient([{ id: "result-auto" }]);
  await forecastRepository.insertForecastResult(
    {
      forecast_run_id: "run-auto",
      inventory_item_id: "item-1",
      predicted_quantity_needed: 80,
      predicted_depletion_date: "2026-10-04",
      recommended_reorder_quantity: 57,
      confidence_notes: "{\"risk_level\":\"HIGH\"}",
      selected_model_name: "TREND_PROJECTION",
      model_evaluation: modelEvaluation,
    },
    autoDb,
  );

  assert.match(autoDb.calls[0].sql, /selected_model_name/);
  assert.match(autoDb.calls[0].sql, /model_evaluation/);
  assert.equal(autoDb.calls[0].values[2], 80);
  assert.equal(autoDb.calls[0].values[6], "TREND_PROJECTION");
  assert.deepEqual(autoDb.calls[0].values[7], modelEvaluation);

  const legacyDb = createCapturingDbClient([{ id: "result-fixed" }]);
  await forecastRepository.insertForecastResult(
    {
      forecast_run_id: "run-fixed",
      inventory_item_id: "item-1",
      predicted_quantity_needed: 10,
      predicted_depletion_date: null,
      recommended_reorder_quantity: 0,
      confidence_notes: null,
    },
    legacyDb,
  );
  assert.equal(legacyDb.calls[0].values[6], null);
  assert.equal(legacyDb.calls[0].values[7], null);
});

test("stored forecast queries select mode and item evaluation without changing filters", async () => {
  const dbClient = createCapturingDbClient([
    { id: "run-auto", selection_mode: "AUTO_BACKTEST", model_name: null },
  ]);

  await forecastRepository.getLatestForecastRunByDisasterEvent("event-1", dbClient);
  assert.match(dbClient.calls[0].sql, /fr\.selection_mode/);

  await forecastRepository.getForecastRunById("run-auto", dbClient);
  assert.match(dbClient.calls[1].sql, /fr\.selection_mode/);

  await forecastRepository.getForecastRunHistory(
    { disasterEventId: "event-1", limit: 5 },
    dbClient,
  );
  assert.match(dbClient.calls[2].sql, /fr\.selection_mode/);
  assert.match(dbClient.calls[2].sql, /WHERE fr\.disaster_event_id = \$1/);
  assert.match(dbClient.calls[2].sql, /LIMIT \$2/);
  assert.deepEqual(dbClient.calls[2].values, ["event-1", 5]);

  await forecastRepository.getForecastResultsByRunId("run-auto", dbClient);
  assert.match(dbClient.calls[3].sql, /fr\.selected_model_name/);
  assert.match(dbClient.calls[3].sql, /fr\.model_evaluation/);
  assert.match(dbClient.calls[3].sql, /ORDER BY ii\.item_name ASC/);

  await forecastRepository.getLatestForecastResultByInventoryItem("item-1", dbClient);
  assert.match(dbClient.calls[4].sql, /fr\.selected_model_name/);
  assert.match(dbClient.calls[4].sql, /fr\.model_evaluation/);
  assert.match(dbClient.calls[4].sql, /run\.selection_mode/);
  assert.match(dbClient.calls[4].sql, /ORDER BY run\.run_at DESC, fr\.created_at DESC/);
});
