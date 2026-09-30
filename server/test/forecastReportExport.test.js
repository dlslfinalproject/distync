const assert = require("node:assert/strict");
const test = require("node:test");

const { buildExportFile } = require("../src/utils/forecastReportExport");

const extractPdfText = (buffer) =>
  [...buffer.toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)]
    .map((match) => match[1].replace(/\\([()\\])/g, "$1"))
    .join(" ");

const buildForecastPayload = () => ({
  forecast_run: {
    run_at: "2026-09-15T00:22:00.000Z",
    model_name: "EXPONENTIAL_SMOOTHING",
    parameters_json: {
      forecast_horizon_days: 14,
      lookback_days: 30,
    },
    disaster_event: {
      title: "Habagat Flood Response 2026",
    },
  },
  dashboard: {
    summary: {
      shortage_item_count: 1,
      total_recommended_reorder: 12,
      seven_day_shortage_count: 1,
      eligible_household_count: 9,
      unclaimed_eligible_household_count: 4,
    },
    charts: {
      forecasted_demand: [
        {
          item_name: "Emergency Water",
          forecasted_usage: 12,
          unit_of_measure: "pc",
        },
      ],
      projected_stock_levels: [
        {
          item_name: "Emergency Water",
          current_available_stock: 5,
          projected_remaining_stock: 0,
          unit_of_measure: "pc",
        },
      ],
      inventory_usage_trend: [
        {
          usage_date: "2026-09-14",
          total_quantity: 4,
        },
      ],
    },
  },
  results: [
    {
      item_name: "Emergency Water",
      current_available_stock: 5,
      forecasted_usage: 12,
      recommended_reorder_quantity: 12,
      projected_remaining_stock: 0,
      projected_household_demand: 10,
      unit_of_measure: "pc",
      projected_depletion_date: "2026-09-16",
      days_until_depletion: 1,
      shortage_within_seven_days: true,
      risk_level: "HIGH",
    },
  ],
});

const CANDIDATE_MODEL_NAMES = [
  "MOVING_AVERAGE",
  "EXPONENTIAL_SMOOTHING",
  "TREND_PROJECTION",
];

const createCandidateEvaluations = ({
  status = "EVALUATED",
  metrics = [
    { mae: 1.25, rmse: 1.5, forecasted_usage: 13.5 },
    { mae: 0, rmse: 0, forecasted_usage: 14.25 },
    { mae: 2, rmse: 3, forecasted_usage: 12 },
  ],
} = {}) =>
  CANDIDATE_MODEL_NAMES.map((model_name, index) => ({
    model_name,
    status,
    mae: metrics[index]?.mae ?? null,
    rmse: metrics[index]?.rmse ?? null,
    backtest_points: status === "EVALUATED" ? 7 : 0,
    forecasted_usage: metrics[index]?.forecasted_usage ?? null,
  }));

const createModelEvaluation = ({
  evaluation_status = "EVALUATED",
  recommendation_status = "RECOMMENDED",
  recommendation_reason = "UNIQUE_LOWEST_MAE",
  recommended_model = "EXPONENTIAL_SMOOTHING",
  selected_model = "EXPONENTIAL_SMOOTHING",
  selection_reason = "HISTORICALLY_RECOMMENDED",
  backtest_points = 7,
  candidates = createCandidateEvaluations(),
} = {}) => ({
  version: 1,
  evaluation_method: "ROLLING_ORIGIN_ONE_STEP",
  timezone: "Asia/Manila",
  eligible_start_date: "2026-09-17",
  eligible_end_date: "2026-09-29",
  evaluation_status,
  available_observations: 14,
  initial_training_points: 7,
  backtest_points,
  recommendation_status,
  recommendation_reason,
  recommended_model,
  selected_model,
  selection_reason,
  raw_statistical_forecast: {
    model_name: selected_model,
    daily_forecast: 1,
    forecasted_usage: 14,
  },
  candidates,
});

const createAutoResult = ({
  item_name = "AUTO ITEM A",
  selected_model_name = "EXPONENTIAL_SMOOTHING",
  model_evaluation = createModelEvaluation(),
  forecasted_usage = 14,
  recommended_reorder_quantity = 9,
  projected_depletion_date = "2026-10-04",
  unit_of_measure = "packs",
} = {}) => ({
  item_name,
  current_available_stock: 5,
  forecasted_usage,
  recommended_reorder_quantity,
  projected_remaining_stock: 0,
  projected_household_demand: 10,
  unit_of_measure,
  projected_depletion_date,
  days_until_depletion: 1,
  shortage_within_seven_days: true,
  risk_level: "HIGH",
  selected_model_name,
  model_evaluation,
});

const buildAutoPayload = (results) => {
  const payload = buildForecastPayload();
  payload.forecast_run.selection_mode = "AUTO_BACKTEST";
  payload.forecast_run.model_name = null;
  payload.results = results;
  return payload;
};

test("forecast export builds a PDF report with the selected forecast content", () => {
  const file = buildExportFile(buildForecastPayload());
  const pdfSource = file.buffer.toString("latin1");

  assert.equal(file.contentType, "application/pdf");
  assert.match(file.filename, /^inventory-forecast-habagat-flood-response-2026-\d{8}\.pdf$/);
  assert.match(pdfSource, /^%PDF-1\.4/);
  assert.match(pdfSource, /Inventory Forecasting Report/);
  assert.match(pdfSource, /Emergency Water/);
  assert.match(pdfSource, /Exponential Smoothing/);
  assert.doesNotMatch(pdfSource, /Historical Model Evaluation|MAE|RMSE/);
});

test("AUTO_BACKTEST report uses a selection method label without a false global model", () => {
  const payload = buildForecastPayload();
  payload.forecast_run.selection_mode = "AUTO_BACKTEST";
  payload.forecast_run.model_name = null;
  const file = buildExportFile(payload);
  const pdfSource = file.buffer.toString("latin1");

  assert.match(pdfSource, /Selection Method/);
  assert.match(pdfSource, /Historical Model Evaluation/);
  assert.doesNotMatch(pdfSource, /Forecast Model/);
  assert.doesNotMatch(pdfSource, /Moving Average/);
  assert.doesNotMatch(file.filename, /null|undefined/i);
});

test("AUTO report includes persisted item selections, validation evidence, and statistical forecasts", () => {
  const payload = buildAutoPayload([
    createAutoResult({
      item_name: "AUTO ITEM A",
      model_evaluation: createModelEvaluation(),
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);

  assert.match(reportText, /Selected Statistical Model/);
  assert.match(reportText, /Recommended Model/);
  assert.match(reportText, /Operational Model Used/);
  assert.match(reportText, /Exponential Smoothing/);
  assert.match(reportText, /Historical Periods Evaluated/);
  assert.match(reportText, /7/);
  assert.match(reportText, /Sep 17, 2026 - Sep 29, 2026 \(Asia\/Manila\)/);
  assert.match(reportText, /Candidate model validation/);
  assert.match(reportText, /Moving Average/);
  assert.match(reportText, /Trend Projection/);
  assert.match(reportText, /MAE/);
  assert.match(reportText, /RMSE/);
  assert.match(reportText, /14\.25 packs/);
  assert.match(reportText, /Historical performance does not guarantee future forecast accuracy\./);
  assert.match(reportText, /Operational Forecast Results by Item/);
  assert.match(reportText, /Operational Forecast Need/);
  assert.doesNotMatch(reportText, /Accuracy %|Confidence %|Best Model|Rank 1|fold predictions|training prefixes/i);
});

test("AUTO fallback report separates the unavailable recommendation from the operational model", () => {
  const insufficientEvaluation = createModelEvaluation({
    evaluation_status: "INSUFFICIENT_HISTORY",
    recommendation_status: "NOT_EVALUATED",
    recommendation_reason: "INSUFFICIENT_HISTORY",
    recommended_model: null,
    selected_model: "MOVING_AVERAGE",
    selection_reason: "OPERATIONAL_FALLBACK",
    backtest_points: 6,
    candidates: createCandidateEvaluations({
      status: "NOT_EVALUATED",
      metrics: [],
    }),
  });
  const payload = buildAutoPayload([
    createAutoResult({
      item_name: "FALLBACK ITEM",
      selected_model_name: "MOVING_AVERAGE",
      model_evaluation: insufficientEvaluation,
      forecasted_usage: 23,
      recommended_reorder_quantity: 15,
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);

  assert.match(reportText, /Recommended Model[\s\S]*?Not available/);
  assert.match(reportText, /Moving Average \(fallback\)/);
  assert.match(reportText, /Insufficient historical data for reliable model comparison\./);
  assert.match(reportText, /Not evaluated/);
  assert.match(reportText, /Operational Forecast Need/);
  assert.match(reportText, /23 packs/);
});

test("AUTO metric tie has no arbitrarily recommended candidate and keeps fallback distinct", () => {
  const tiedCandidates = createCandidateEvaluations({
    metrics: CANDIDATE_MODEL_NAMES.map(() => ({
      mae: 1,
      rmse: 2,
      forecasted_usage: 10,
    })),
  });
  const payload = buildAutoPayload([
    createAutoResult({
      item_name: "TIED ITEM",
      selected_model_name: "MOVING_AVERAGE",
      model_evaluation: createModelEvaluation({
        recommendation_status: "NO_RECOMMENDATION",
        recommendation_reason: "METRIC_TIE",
        recommended_model: null,
        selected_model: "MOVING_AVERAGE",
        selection_reason: "OPERATIONAL_FALLBACK",
        candidates: tiedCandidates,
      }),
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);

  assert.match(
    reportText,
    /No unique recommendation was identified from the historical error results\./,
  );
  assert.match(reportText, /Moving Average \(fallback\)/);
  assert.doesNotMatch(reportText, /Moving Average \(Recommended\)|Exponential Smoothing \(Recommended\)|Trend Projection \(Recommended\)/);
});

test("AUTO no-signal and unavailable-candidate states use neutral persisted reasons", () => {
  const noSignal = createModelEvaluation({
    recommendation_status: "NO_RECOMMENDATION",
    recommendation_reason: "NO_DISCRIMINATING_SIGNAL",
    recommended_model: null,
    selected_model: "MOVING_AVERAGE",
    selection_reason: "OPERATIONAL_FALLBACK",
  });
  const unavailableCandidates = createCandidateEvaluations({
    metrics: [
      { mae: 1, rmse: 2, forecasted_usage: 10 },
      { mae: 0.5, rmse: 1, forecasted_usage: 11 },
      { mae: null, rmse: null, forecasted_usage: null },
    ],
  });
  unavailableCandidates[2].status = "UNAVAILABLE";
  const unavailable = createModelEvaluation({
    recommendation_status: "NO_RECOMMENDATION",
    recommendation_reason: "CANDIDATE_UNAVAILABLE",
    recommended_model: null,
    selected_model: "MOVING_AVERAGE",
    selection_reason: "OPERATIONAL_FALLBACK",
    candidates: unavailableCandidates,
  });
  const reportText = extractPdfText(buildExportFile(
    buildAutoPayload([
      createAutoResult({
        item_name: "NO SIGNAL ITEM",
        selected_model_name: "MOVING_AVERAGE",
        model_evaluation: noSignal,
      }),
      createAutoResult({
        item_name: "UNAVAILABLE ITEM",
        selected_model_name: "MOVING_AVERAGE",
        model_evaluation: unavailable,
      }),
    ]),
  ).buffer);

  assert.match(
    reportText,
    /The available historical distribution data did not provide enough difference to recommend one model\./,
  );
  assert.match(
    reportText,
    /The forecasting methods could not all be evaluated using the same historical periods\./,
  );
  assert.match(reportText, /Unavailable/);
  assert.doesNotMatch(reportText, /data error/i);
});

test("AUTO report preserves zero metrics and renders null metrics and forecasts as unavailable", () => {
  const candidates = createCandidateEvaluations({
    metrics: [
      { mae: 0, rmse: 0, forecasted_usage: 0 },
      { mae: null, rmse: null, forecasted_usage: null },
      { mae: 1, rmse: 2, forecasted_usage: 3 },
    ],
  });
  candidates[0].status = "EVALUATED";
  candidates[1].status = "UNAVAILABLE";
  const payload = buildAutoPayload([
    createAutoResult({
      selected_model_name: "MOVING_AVERAGE",
      model_evaluation: createModelEvaluation({
        recommendation_status: "NO_RECOMMENDATION",
        recommendation_reason: "CANDIDATE_UNAVAILABLE",
        recommended_model: null,
        selected_model: "MOVING_AVERAGE",
        selection_reason: "OPERATIONAL_FALLBACK",
        candidates,
      }),
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);

  assert.match(reportText, /Moving Average 0 0 0 packs Evaluated/);
  assert.match(reportText, /Exponential Smoothing -- -- -- Unavailable/);
  assert.doesNotMatch(reportText, /MAE[\s\S]{0,40}0\.00/);
});

test("AUTO report handles missing, malformed, and unknown optional evaluation without losing operational results", () => {
  const payload = buildAutoPayload([
    createAutoResult({
      item_name: "MISSING EVIDENCE ITEM",
      model_evaluation: null,
      forecasted_usage: 21,
    }),
    createAutoResult({
      item_name: "MALFORMED EVIDENCE ITEM",
      model_evaluation: "{not valid json",
      forecasted_usage: 22,
    }),
    createAutoResult({
      item_name: "UNKNOWN STATUS ITEM",
      model_evaluation: createModelEvaluation({
        evaluation_status: "FUTURE_EVALUATION_STATUS",
      }),
      forecasted_usage: 23,
    }),
    createAutoResult({
      item_name: "INCONSISTENT EVIDENCE ITEM",
      model_evaluation: createModelEvaluation({
        selected_model: "TREND_PROJECTION",
      }),
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);

  assert.equal(
    (reportText.match(/Model validation information unavailable\./g) || []).length,
    4,
  );
  assert.match(reportText, /MISSING EVIDENCE ITEM/);
  assert.match(reportText, /MALFORMED EVIDENCE ITEM/);
  assert.match(reportText, /UNKNOWN STATUS ITEM/);
  assert.match(reportText, /INCONSISTENT EVIDENCE ITEM/);
  assert.match(reportText, /Operational Forecast Need/);
  assert.match(reportText, /21 packs/);
  assert.match(reportText, /22 packs/);
  assert.match(reportText, /23 packs/);
  assert.doesNotMatch(reportText, /Candidate model validation/);
});

test("AUTO report keeps item models and candidate order independent across a multi-item run", () => {
  const payload = buildAutoPayload([
    createAutoResult({
      item_name: "AUTO ITEM A",
      selected_model_name: "EXPONENTIAL_SMOOTHING",
      model_evaluation: createModelEvaluation(),
    }),
    createAutoResult({
      item_name: "AUTO ITEM B",
      selected_model_name: "MOVING_AVERAGE",
      model_evaluation: createModelEvaluation({
        evaluation_status: "INSUFFICIENT_HISTORY",
        recommendation_status: "NOT_EVALUATED",
        recommendation_reason: "INSUFFICIENT_HISTORY",
        recommended_model: null,
        selected_model: "MOVING_AVERAGE",
        selection_reason: "OPERATIONAL_FALLBACK",
        backtest_points: 6,
        candidates: createCandidateEvaluations({
          status: "NOT_EVALUATED",
          metrics: [],
        }),
      }),
    }),
    createAutoResult({
      item_name: "AUTO ITEM C",
      selected_model_name: "TREND_PROJECTION",
      model_evaluation: createModelEvaluation({
        recommended_model: "TREND_PROJECTION",
        selected_model: "TREND_PROJECTION",
        recommendation_reason: "LOWEST_RMSE_AFTER_MAE_TIE",
      }),
    }),
  ]);
  const reportText = extractPdfText(buildExportFile(payload).buffer);
  const candidateSection = reportText.slice(
    reportText.indexOf("Candidate model validation"),
  );
  const movingAverageIndex = candidateSection.indexOf("Moving Average");
  const exponentialSmoothingIndex =
    candidateSection.indexOf("Exponential Smoothing");
  const trendProjectionIndex = candidateSection.indexOf("Trend Projection");

  assert.match(reportText, /AUTO ITEM A/);
  assert.match(reportText, /AUTO ITEM B/);
  assert.match(reportText, /AUTO ITEM C/);
  assert.match(reportText, /Moving Average \(fallback\)/);
  assert.match(reportText, /Trend Projection/);
  assert.ok(movingAverageIndex >= 0);
  assert.ok(exponentialSmoothingIndex > movingAverageIndex);
  assert.ok(trendProjectionIndex > exponentialSmoothingIndex);
  assert.match(reportText, /Page 6/);
});

test("AUTO report accepts additive evaluation fields and does not rely on fold data", () => {
  const evaluation = createModelEvaluation();
  evaluation.newer_optional_field = { retained: true };
  const reportText = extractPdfText(buildExportFile(
    buildAutoPayload([
      createAutoResult({
        model_evaluation: evaluation,
      }),
    ]),
  ).buffer);

  assert.match(reportText, /Candidate model validation/);
  assert.doesNotMatch(reportText, /fold predictions|training prefixes|target rows/i);
});
