import assert from "node:assert/strict";
import test from "node:test";
import {
  forecastModelOptions,
  getForecastModelDescription,
  getForecastModelRecommendation,
} from "../src/features/inventory-items/inventoryItemExportOptions.js";

const buildTrend = (values) =>
  values.map((total_quantity, index) => ({
    usage_date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    total_quantity,
  }));

test("forecast model options explain the practical difference between all models", () => {
  assert.equal(forecastModelOptions.length, 3);
  forecastModelOptions.forEach((option) => {
    assert.ok(option.description);
  });

  assert.match(
    getForecastModelDescription("EXPONENTIAL_SMOOTHING"),
    /supply use is changing quickly/i,
  );
});

test("limited event history suggests moving average", () => {
  const recommendation = getForecastModelRecommendation({
    event: { start_date: "2026-09-14" },
    forecastContext: { usage_trend: [] },
  });

  assert.equal(recommendation.modelName, "MOVING_AVERAGE");
  assert.match(recommendation.rationale, /not enough event-specific history/i);
});

test("a recent usage shift suggests exponential smoothing", () => {
  const recommendation = getForecastModelRecommendation({
    event: { start_date: "2026-08-01" },
    forecastContext: {
      usage_trend: buildTrend([
        2, 2, 2, 2, 2, 2, 2,
        6, 6, 6, 6, 6, 6, 6,
      ]),
    },
  });

  assert.equal(recommendation.modelName, "EXPONENTIAL_SMOOTHING");
  assert.match(recommendation.rationale, /recent activity/i);
});

test("a clear sustained event trend suggests trend projection", () => {
  const recommendation = getForecastModelRecommendation({
    event: { start_date: "2026-07-01" },
    forecastContext: {
      usage_trend: buildTrend(
        Array.from({ length: 14 }, (_value, index) => index + 1),
      ),
    },
  });

  assert.equal(recommendation.modelName, "TREND_PROJECTION");
  assert.match(recommendation.rationale, /sustained direction/i);
});

test("stable event activity keeps moving average as the recommendation", () => {
  const recommendation = getForecastModelRecommendation({
    event: { start_date: "2026-07-01" },
    forecastContext: {
      usage_trend: buildTrend(Array.from({ length: 14 }, () => 5)),
    },
  });

  assert.equal(recommendation.modelName, "MOVING_AVERAGE");
  assert.match(recommendation.rationale, /stable baseline/i);
});
