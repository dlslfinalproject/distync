import assert from "node:assert/strict";
import test from "node:test";
import {
  BARANGAY_CHART_COLORS,
  BARANGAY_CHART_HIGHLIGHT_COLOR,
  getBarangayChartColorMap,
  getBarangayChartColors,
} from "../src/components/mswdo-analytics/barangayChartColors.mjs";
import { mapBarangayCoverageDistribution } from "../src/features/mswdo-analytics/barangayCoverage.mjs";

test("Barangay coverage creates one equal slice per covered Barangay", () => {
  const distribution = mapBarangayCoverageDistribution({
    barangays: [
      { id: "2", name: "Santiago" },
      { id: "1", name: "Bagong Pook" },
    ],
    coveredCount: 2,
  });

  assert.deepEqual(distribution, [
    { barangay_id: "1", name: "Bagong Pook", value: 1 },
    { barangay_id: "2", name: "Santiago", value: 1 },
  ]);
});

test("specific Barangay coverage keeps only the selected Barangay slice", () => {
  assert.deepEqual(
    mapBarangayCoverageDistribution({
      barangays: [
        { id: "2", name: "Santiago" },
        { id: "1", name: "Bagong Pook" },
      ],
      coveredCount: 1,
      selectedBarangayId: "2",
    }),
    [{ barangay_id: "2", name: "Santiago", value: 1 }],
  );
});

test("coverage retains the aggregate fallback when Barangay names are unavailable", () => {
  assert.deepEqual(
    mapBarangayCoverageDistribution({ barangays: [], coveredCount: 3 }),
    [{ name: "Covered", value: 3 }],
  );
});

test("the coverage color map reuses the affected-families bar colors", () => {
  const familyData = [
    { name: "Bagong Pook", value: 8 },
    { name: "Santiago", value: 44 },
  ];
  const barColors = getBarangayChartColors(familyData);
  const colorMap = getBarangayChartColorMap({
    sourceData: familyData,
    targetData: [
      { name: "Santiago", value: 1 },
      { name: "Bagong Pook", value: 1 },
      { name: "Bulihan", value: 1 },
    ],
  });

  assert.equal(barColors[0], "#1f9d8a");
  assert.equal(barColors[1], BARANGAY_CHART_HIGHLIGHT_COLOR);
  assert.equal(colorMap["Bagong Pook"], barColors[0]);
  assert.equal(colorMap.Santiago, barColors[1]);
  assert.ok(BARANGAY_CHART_COLORS.includes(colorMap.Bulihan));
  assert.notEqual(colorMap.Bulihan, colorMap["Bagong Pook"]);
});
