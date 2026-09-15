const assert = require("node:assert/strict");
const test = require("node:test");

const { buildExportFile } = require("../src/utils/forecastReportExport");

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

test("forecast export builds a PDF report with the selected forecast content", () => {
  const file = buildExportFile(buildForecastPayload());
  const pdfSource = file.buffer.toString("latin1");

  assert.equal(file.contentType, "application/pdf");
  assert.match(file.filename, /^inventory-forecast-habagat-flood-response-2026-\d{8}\.pdf$/);
  assert.match(pdfSource, /^%PDF-1\.4/);
  assert.match(pdfSource, /Inventory Forecasting Report/);
  assert.match(pdfSource, /Emergency Water/);
  assert.match(pdfSource, /Exponential Smoothing/);
});
