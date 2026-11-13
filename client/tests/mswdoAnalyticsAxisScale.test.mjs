import assert from "node:assert/strict";
import test from "node:test";
import {
  getChartAxisMax,
  getChartAxisTicks,
} from "../src/components/mswdo-analytics/chartScale.mjs";

test("analytics chart maximum rounds up to the next five", () => {
  assert.equal(getChartAxisMax(68), 70);
  assert.equal(getChartAxisMax(70), 70);
  assert.equal(getChartAxisMax(71), 75);
});

test("desktop chart ticks use five-unit increments and include the maximum", () => {
  assert.deepEqual(getChartAxisTicks({ axisMax: 70 }), [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70,
  ]);
});

test("compact chart ticks stay readable while ending at the rounded maximum", () => {
  assert.deepEqual(getChartAxisTicks({ axisMax: 70, isNarrow: true }), [
    0, 10, 20, 30, 40, 50, 60, 70,
  ]);
  assert.deepEqual(getChartAxisTicks({ axisMax: 68, isCompact: true }), [
    0, 10, 20, 30, 40, 50, 60, 70,
  ]);
});
