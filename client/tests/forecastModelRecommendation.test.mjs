import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  forecastModelOptions,
  getForecastModelDescription,
  getForecastModelLabel,
} from "../src/features/inventory-items/inventoryItemExportOptions.js";

const readOptionsSource = () =>
  fs.readFile(new URL("../src/features/inventory-items/inventoryItemExportOptions.js", import.meta.url), "utf8");

test("forecast model metadata retains labels and descriptions for persisted results", () => {
  assert.deepEqual(
    forecastModelOptions.map(({ value, label }) => [value, label]),
    [
      ["MOVING_AVERAGE", "Moving Average"],
      ["EXPONENTIAL_SMOOTHING", "Exponential Smoothing"],
      ["TREND_PROJECTION", "Trend Projection"],
    ],
  );
  forecastModelOptions.forEach((option) => assert.ok(option.description));
  assert.match(getForecastModelDescription("EXPONENTIAL_SMOOTHING"), /supply use is changing quickly/i);
});

test("model labels do not recommend a model from browser-side event heuristics", async () => {
  const source = await readOptionsSource();

  assert.equal(getForecastModelLabel("MOVING_AVERAGE"), "Moving Average");
  assert.equal(getForecastModelLabel("EXPONENTIAL_SMOOTHING"), "Exponential Smoothing");
  assert.equal(getForecastModelLabel("TREND_PROJECTION"), "Trend Projection");
  assert.equal(getForecastModelLabel(null), "Model unavailable");
  assert.doesNotMatch(source, /getForecastModelRecommendation|getLinearTrendStats|getEventAgeInDays/);
});
