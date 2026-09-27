import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  BARANGAY_HEATMAP_COLORS,
  BARANGAY_HEATMAP_METRICS,
  BARANGAY_HEATMAP_UNAFFECTED_COLOR,
  DEFAULT_BARANGAY_HEATMAP_METRIC,
  buildBarangayHeatmapModel,
  indexBarangayHeatmapRows,
  createBarangayHeatmapInteractionHandlers,
  getSelectedBarangayHeatmapRow,
} from "../src/components/mswdo-analytics/barangayHeatmapModel.mjs";

const readSource = (...segments) =>
  fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

const geoJsonPath = path.join(
  process.cwd(),
  "src",
  "assets",
  "malvar-barangays.geojson",
);
const geoJsonSource = fs.readFileSync(geoJsonPath, "utf8");
const geoJson = JSON.parse(geoJsonSource);

const makeRows = () =>
  geoJson.features.map((feature, index) => ({
    barangay_id: "barangay-" + (index + 1),
    barangay_code: feature.properties.distync_code,
    barangay_name: feature.properties.adm4_name,
    is_affected: index < 2,
    registered_households: index === 0 ? 0 : index === 1 ? 2 : 9999,
    active_evacuees: index === 0 ? 0 : index === 1 ? 3 : 9999,
    issued_stubs: index === 0 ? 0 : index === 1 ? 5 : 9999,
    claimed_stubs: index === 0 ? 0 : index === 1 ? 2 : 9999,
    pending_relief_claims: index === 0 ? 0 : index === 1 ? 3 : 9999,
  }));

test("the bundled Malvar GeoJSON has 15 unique code crosswalks to the API rows", () => {
  const rows = makeRows();
  const model = buildBarangayHeatmapModel(geoJson.features, rows);

  assert.equal(geoJson.type, "FeatureCollection");
  assert.equal(geoJson.features.length, 15);
  const codes = geoJson.features.map((feature) => feature.properties.distync_code);
  assert.equal(new Set(codes).size, 15);
  assert.deepEqual(
    model.rows.map((row) => row.apiRow?.barangay_code),
    codes,
  );
  assert.equal(model.matchedCount, 15);
  assert.equal(model.hasJoinMismatch, false);

  const componentSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.jsx",
  );
  assert.match(componentSource, /malvar-barangays\.geojson\?raw/);
  assert.match(componentSource, /JSON\.parse\(malvarBarangaysRaw\)/);
  assert.doesNotMatch(componentSource, /fetch\s*\(|https?:\/\//);
});

test("unaffected, affected-zero, affected-positive, and unavailable rows use separate states", () => {
  const rows = makeRows();
  const model = buildBarangayHeatmapModel(geoJson.features, rows);
  const zero = model.rows.find((row) => row.value === 0 && row.status === "affected");
  const positive = model.rows.find((row) => row.value > 0 && row.status === "affected");
  const unaffected = model.rows.find((row) => row.status === "unaffected");
  const unavailableModel = buildBarangayHeatmapModel(
    geoJson.features,
    rows.filter((row) => row.barangay_code !== geoJson.features[3].properties.distync_code),
  );
  const unavailable = unavailableModel.rows[3];

  assert.equal(zero.colorIndex, 0);
  assert.equal(zero.fill, BARANGAY_HEATMAP_COLORS[0]);
  assert.equal(positive.fill, BARANGAY_HEATMAP_COLORS[2]);
  assert.equal(unaffected.fill, BARANGAY_HEATMAP_UNAFFECTED_COLOR);
  assert.notEqual(zero.fill, unaffected.fill);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.apiRow, null);
  assert.equal(unavailableModel.hasJoinMismatch, true);
  assert.equal(model.maxValue, 2);
  assert.equal(model.maxValue, Math.max(...model.rows
    .filter((row) => row.status === "affected")
    .map((row) => row.value)));
});

test("the selected metric stays local and recalculates values and range", () => {
  const rows = makeRows();
  const expected = [
    ["registered_households", "Registered Households", 2],
    ["active_evacuees", "Active Evacuees", 3],
    ["pending_relief_claims", "Pending Relief Claims", 3],
  ];

  assert.equal(DEFAULT_BARANGAY_HEATMAP_METRIC, "registered_households");
  assert.deepEqual(
    BARANGAY_HEATMAP_METRICS.map(({ key, label }) => [key, label]),
    expected.map(([key, label]) => [key, label]),
  );

  const rowLookup = indexBarangayHeatmapRows(rows);
  for (const [key, label, maxValue] of expected) {
    const model = buildBarangayHeatmapModel(
      geoJson.features,
      rowLookup,
      key,
    );
    assert.equal(model.metric.label, label);
    assert.equal(model.maxValue, maxValue);
  }

  const componentSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.jsx",
  );
  assert.match(
    componentSource,
    /useState\(\s*DEFAULT_BARANGAY_HEATMAP_METRIC\s*,?\s*\)/,
  );
  assert.match(componentSource, /onChange=\{\(event\) => setSelectedMetric/);
  assert.doesNotMatch(
    componentSource,
    /mswdoAnalyticsService|axios|fetch\s*\(/,
  );
});

test("zero affected values stay at the lightest scale color", () => {
  const rows = makeRows().map((row) => ({
    ...row,
    registered_households: row.is_affected ? 0 : 80000,
  }));
  const model = buildBarangayHeatmapModel(
    geoJson.features,
    rows,
    "registered_households",
  );

  assert.equal(model.affectedCount, 2);
  assert.equal(model.maxValue, 0);
  assert.ok(
    model.rows
      .filter((row) => row.status === "affected")
      .every(
        (row) =>
          row.colorIndex === 0 &&
          row.fill === BARANGAY_HEATMAP_COLORS[0],
      ),
  );
  assert.ok(
    model.rows
      .filter((row) => row.status === "unaffected")
      .every((row) => row.fill === BARANGAY_HEATMAP_UNAFFECTED_COLOR),
  );
});

test("barangay click and keyboard activation select the same persistent key", () => {
  const selections = [];
  const handlers = createBarangayHeatmapInteractionHandlers(
    "BULIHAN",
    (key) => selections.push(key),
  );

  handlers.onClick();
  let prevented = false;
  handlers.onKeyDown({
    key: "Enter",
    preventDefault: () => {
      prevented = true;
    },
  });
  handlers.onKeyDown({
    key: " ",
    preventDefault: () => {
      prevented = true;
    },
  });
  handlers.onKeyDown({
    key: "ArrowUp",
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.deepEqual(selections, ["BULIHAN", "BULIHAN", "BULIHAN"]);
  assert.equal(prevented, true);
});

test("selected details retain the Stage 1 aggregate fields across metric changes", () => {
  const rows = makeRows();
  const expected = [
    ["registered_households", 2],
    ["active_evacuees", 3],
    ["pending_relief_claims", 3],
  ];

  for (const [metric, value] of expected) {
    const model = buildBarangayHeatmapModel(geoJson.features, rows, metric);
    const selected = getSelectedBarangayHeatmapRow(model, "BILUCAO");

    assert.equal(
      selected.name,
      rows.find((row) => row.barangay_code === "BILUCAO").barangay_name,
    );
    assert.equal(selected.apiRow.registered_households, 2);
    assert.equal(selected.apiRow.active_evacuees, 3);
    assert.equal(selected.apiRow.claimed_stubs, 2);
    assert.equal(selected.apiRow.pending_relief_claims, 3);
    assert.equal(selected.value, value);
  }
});

test("the component renders all 15 accessible polygons, default metric, and the empty selection prompt", async () => {
  const vite = await createServer({
    root: process.cwd(),
    configFile: false,
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });

  try {
    const { default: BarangayHeatMap } = await vite.ssrLoadModule(
      "/src/components/mswdo-analytics/BarangayHeatMap.jsx",
    );
    const html = renderToStaticMarkup(
      React.createElement(BarangayHeatMap, { barangays: makeRows() }),
    );
    const pathCount = (html.match(/<path\b/g) || []).length;
    const buttonCount = (html.match(/role="button"/g) || []).length;

    assert.equal(pathCount, 15);
    assert.equal(buttonCount, 15);
    assert.match(html, /aria-label="Heat map metric"/);
    assert.match(html, /Registered Households/);
    assert.match(html, /Not affected by selected event/);
    assert.match(html, /Select a barangay to view its summary\./);
    assert.match(html, /aria-pressed="false"/);
  } finally {
    await vite.close();
  }
});

test("page integration renders the map independently of chart hasData", () => {
  const pageSource = readSource(
    "src",
    "pages",
    "mswdo",
    "AnalyticsDashboardPage.jsx",
  );
  const hookSource = readSource(
    "src",
    "features",
    "mswdo-analytics",
    "useMswdoAnalytics.js",
  );
  const componentBlock = pageSource.match(
    /\{hasSelectedEvent &&\s*!baseIsInitialLoadingFilters &&\s*!baseIsInitialLoadingDashboard &&\s*!errorMessage \? \([\s\S]*?<BarangayHeatMap[\s\S]*?\) : null\}/,
  );
  const noDataIndex = pageSource.indexOf("!hasData");

  assert.ok(componentBlock);
  assert.doesNotMatch(componentBlock[0], /hasData/);
  assert.ok(pageSource.indexOf("barangayHeatmap") < noDataIndex);
  assert.match(pageSource, /key=\{selectedDisasterEventId\}/);
  assert.match(pageSource, /barangays=\{barangayHeatmap\}/);
  assert.match(
    hookSource,
    /barangayHeatmap:[\s\S]*?selectedDisasterEventId[\s\S]*?Array\.isArray\(operationalPayload\.barangay_heatmap\)/,
  );
});

test("cached dashboard payload supplies the map without a separate heat-map fetch", () => {
  const hookSource = readSource(
    "src",
    "features",
    "mswdo-analytics",
    "useMswdoAnalytics.js",
  );
  const componentSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.jsx",
  );

  assert.match(
    hookSource,
    /setOperationalPayload\(cached\.datasets\.dashboard\.payload \|\| emptyOperationalPayload\)/,
  );
  assert.match(componentSource, /indexBarangayHeatmapRows\(barangays\)/);
  assert.match(componentSource, /\[barangays\]/);
  assert.match(componentSource, /barangayRowLookup,\s*selectedMetric/);
  assert.doesNotMatch(
    componentSource,
    /fetchMasterlistOperationalAnalytics|mswdoAnalyticsService|axios|fetch\s*\(/,
  );
});

test("mobile layout stacks the details below a full-width map and keeps focus visible", () => {
  const cssSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.css",
  );
  const componentSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.jsx",
  );

  assert.match(cssSource, /\.barangay-heatmap-svg\s*\{[\s\S]*?width:\s*100%/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.barangay-heatmap-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(cssSource, /\.barangay-heatmap-polygon:focus-visible/);
  assert.match(componentSource, /tabIndex=\{0\}/);
  assert.match(componentSource, /aria-pressed=\{isSelected\}/);
});

test("details exclude household and individual identifying information", () => {
  const componentSource = readSource(
    "src",
    "components",
    "mswdo-analytics",
    "BarangayHeatMap.jsx",
  );

  assert.doesNotMatch(
    componentSource,
    /family_name|household_id|\baddress\b|\bphoto\b|evacuee record/i,
  );
  assert.match(componentSource, /Claimed Relief Stubs/);
  assert.match(componentSource, /Pending Relief Claims/);
});
