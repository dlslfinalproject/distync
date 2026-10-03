import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { geoArea, geoBounds } from "d3-geo";
import {
  BARANGAY_HEATMAP_COLORS,
  BARANGAY_HEATMAP_METRICS,
  BARANGAY_HEATMAP_UNAFFECTED_COLOR,
  BARANGAY_HEATMAP_VIEWBOX,
  DEFAULT_BARANGAY_HEATMAP_METRIC,
  buildBarangayHeatmapModel,
  indexBarangayHeatmapRows,
  createBarangayHeatmapInteractionHandlers,
  createBarangayHeatmapGeometry,
  formatBarangayHeatmapAriaLabel,
  formatBarangayHeatmapTooltip,
  getSelectedBarangayHeatmapRow,
  normalizeGeoJsonWindingForD3,
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

const signedRingArea = (ring) =>
  ring.slice(0, -1).reduce((twiceArea, point, index) => {
    const next = ring[index + 1];
    return twiceArea + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;

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

test("raw RFC 7946 winding makes d3-geo interpret each barangay as its spherical complement", () => {
  const sourceSnapshot = structuredClone(geoJson);
  const geometry = createBarangayHeatmapGeometry(geoJson);

  assert.deepEqual(geoJson, sourceSnapshot);
  assert.equal(geometry.geoJson.features.length, 15);

  for (const [index, rawFeature] of geoJson.features.entries()) {
    const normalizedFeature = geometry.geoJson.features[index];
    const rawExterior = rawFeature.geometry.coordinates[0];
    const normalizedExterior = normalizedFeature.geometry.coordinates[0];
    const rawArea = geoArea(rawFeature);
    const normalizedArea = geoArea(normalizedFeature);
    const rawBounds = geoBounds(rawFeature);
    const normalizedBounds = geoBounds(normalizedFeature);

    assert.ok(signedRingArea(rawExterior) > 0, rawFeature.properties.distync_code);
    assert.ok(signedRingArea(normalizedExterior) < 0, rawFeature.properties.distync_code);
    assert.ok(rawArea > 2 * Math.PI, rawFeature.properties.distync_code);
    assert.ok(normalizedArea > 0 && normalizedArea < 2 * Math.PI, rawFeature.properties.distync_code);
    assert.ok(Math.abs(rawArea + normalizedArea - 4 * Math.PI) < 1e-10);
    assert.deepEqual(rawBounds, [[-180, -90], [180, 90]]);
    assert.ok(normalizedBounds[0][0] > 120 && normalizedBounds[1][0] < 122);
    assert.ok(normalizedBounds[0][1] > 13 && normalizedBounds[1][1] < 15);
  }
});

test("D3 winding normalization immutably handles Polygon holes and MultiPolygon grouping", () => {
  const exterior = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
  const hole = [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]];
  const secondExterior = [[10, 0], [14, 0], [14, 4], [10, 4], [10, 0]];
  const source = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "polygon-with-hole",
        properties: { distync_code: "POLYGON" },
        geometry: { type: "Polygon", coordinates: [exterior, hole] },
      },
      {
        type: "Feature",
        id: "multipolygon",
        properties: { distync_code: "MULTIPOLYGON" },
        geometry: {
          type: "MultiPolygon",
          coordinates: [[exterior, hole], [secondExterior]],
        },
      },
    ],
  };
  const sourceSnapshot = structuredClone(source);
  const normalized = normalizeGeoJsonWindingForD3(source);

  assert.deepEqual(source, sourceSnapshot);
  assert.notEqual(normalized, source);
  assert.equal(normalized.features[0].geometry.coordinates.length, 2);
  assert.ok(signedRingArea(normalized.features[0].geometry.coordinates[0]) < 0);
  assert.ok(signedRingArea(normalized.features[0].geometry.coordinates[1]) > 0);
  assert.deepEqual(
    normalized.features[0].geometry.coordinates[0],
    [...exterior].reverse(),
  );
  assert.deepEqual(
    normalized.features[0].geometry.coordinates[1],
    [...hole].reverse(),
  );
  assert.equal(normalized.features[1].geometry.coordinates.length, 2);
  assert.equal(normalized.features[1].geometry.coordinates[0].length, 2);
  assert.equal(normalized.features[1].geometry.coordinates[1].length, 1);
  assert.ok(signedRingArea(normalized.features[1].geometry.coordinates[0][0]) < 0);
  assert.ok(signedRingArea(normalized.features[1].geometry.coordinates[0][1]) > 0);
  assert.ok(signedRingArea(normalized.features[1].geometry.coordinates[1][0]) < 0);
});

test("normalized Malvar geometry produces 15 finite, localized paths inside the fitted viewBox", () => {
  const geometry = createBarangayHeatmapGeometry(geoJson);
  const { width, height, padding } = BARANGAY_HEATMAP_VIEWBOX;
  const [[left, top], [right, bottom]] = geometry.pathGenerator.bounds(
    geometry.geoJson,
  );
  const paths = [...geometry.pathByFeature.values()];
  const featureBounds = geometry.geoJson.features.map((feature) =>
    geometry.pathGenerator.bounds(feature),
  );
  const largestFeatureWidth = Math.max(
    ...featureBounds.map(([[featureLeft], [featureRight]]) => featureRight - featureLeft),
  );
  const largestFeatureHeight = Math.max(
    ...featureBounds.map(([[, featureTop], [, featureBottom]]) => featureBottom - featureTop),
  );

  assert.equal(geometry.geoJson.features.length, 15);
  assert.equal(geometry.pathByFeature.size, 15);
  assert.ok(right - left > width * 0.5);
  assert.ok(bottom - top > height * 0.5);
  assert.ok(largestFeatureWidth < (width - 2 * padding) * 0.5);
  assert.ok(largestFeatureHeight < (height - 2 * padding) * 0.5);
  assert.ok(left >= padding - 0.001 && top >= padding - 0.001);
  assert.ok(right <= width - padding + 0.001);
  assert.ok(bottom <= height - padding + 0.001);
  assert.ok(paths.every((path) => typeof path === "string" && path.length > 0));
  assert.ok(paths.every((path) => !/(?:NaN|Infinity)/.test(path)));
});

test("the bundled Malvar GeoJSON has 15 unique code crosswalks to the API rows", () => {
  const rows = makeRows();
  const normalized = createBarangayHeatmapGeometry(geoJson).geoJson;
  const model = buildBarangayHeatmapModel(normalized.features, rows);

  assert.equal(geoJson.type, "FeatureCollection");
  assert.equal(normalized.features.length, 15);
  const codes = normalized.features.map((feature) => feature.properties.distync_code);
  assert.equal(new Set(codes).size, 15);
  assert.deepEqual(
    normalized.features.map((feature) => feature.properties),
    geoJson.features.map((feature) => feature.properties),
  );
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
  assert.match(componentSource, /createBarangayHeatmapGeometry\(JSON\.parse\(malvarBarangaysRaw\)\)/);
  assert.doesNotMatch(componentSource, /fetch\s*\(|https?:\/\//);
});

test("the San Pioquinto boundary joins to and selects the San Pioquinto API row", () => {
  const normalized = createBarangayHeatmapGeometry(geoJson).geoJson;
  const model = buildBarangayHeatmapModel(normalized.features, makeRows());
  const selected = getSelectedBarangayHeatmapRow(model, "SAN_PIOQUINTO");

  assert.equal(selected.name, "San Pioquinto");
  assert.equal(selected.apiRow.barangay_code, "SAN_PIOQUINTO");

  const selections = [];
  const handlers = createBarangayHeatmapInteractionHandlers("SAN_PIOQUINTO", (key) =>
    selections.push(key),
  );
  handlers.onClick();
  handlers.onKeyDown({ key: "Enter", preventDefault() {} });
  handlers.onKeyDown({ key: " ", preventDefault() {} });
  assert.deepEqual(selections, ["SAN_PIOQUINTO", "SAN_PIOQUINTO", "SAN_PIOQUINTO"]);
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
  const geometry = createBarangayHeatmapGeometry(geoJson);
  const pathByFeature = geometry.pathByFeature;
  const initialPaths = [...pathByFeature.values()];
  const expected = [
    ["registered_households", "Registered Households", 2],
    ["active_evacuees", "Active Evacuees", 3],
    ["claimed_stubs", "Claimed Relief Stubs", 2],
    ["pending_relief_claims", "Pending Relief Claims", 3],
    ["issued_stubs", "Valid Issued Stubs", 5],
  ];

  assert.equal(DEFAULT_BARANGAY_HEATMAP_METRIC, "registered_households");
  assert.deepEqual(
    BARANGAY_HEATMAP_METRICS.map(({ key, label }) => [key, label]),
    expected.map(([key, label]) => [key, label]),
  );

  const rowLookup = indexBarangayHeatmapRows(rows);
  for (const [key, label, maxValue] of expected) {
    const model = buildBarangayHeatmapModel(
      geometry.geoJson.features,
      rowLookup,
      key,
    );
    assert.equal(model.metric.label, label);
    assert.equal(model.maxValue, maxValue);
    assert.equal(geometry.pathByFeature, pathByFeature);
    assert.deepEqual([...geometry.pathByFeature.values()], initialPaths);
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

test("heat-map tooltip labels stay concise and follow the selected metric", () => {
  const expected = [
    ["Registered Households", 4],
    ["Claimed Relief Stubs", 2],
    ["Pending Relief Claims", 1],
    ["Valid Issued Stubs", 3],
  ];

  for (const [metricLabel, value] of expected) {
    assert.equal(
      formatBarangayHeatmapTooltip({
        barangayName: "Poblacion",
        metricLabel,
        value,
      }),
      `Poblacion\n${metricLabel} : ${value}`,
    );
    assert.equal(
      formatBarangayHeatmapAriaLabel({
        barangayName: "Poblacion",
        metricLabel,
        value,
      }),
      `Poblacion, ${metricLabel}: ${value}`,
    );
  }
});

test("the rendered heat-map title uses the active metric without selection text", async () => {
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
    assert.match(html, /<title>Poblacion\nRegistered Households : 0<\/title>/);
    assert.match(html, /aria-label="Poblacion, Registered Households: 0"/);
    assert.doesNotMatch(html, /Affected by selected event.*Registered Households/);
    assert.doesNotMatch(html, /Selected<\/title>/);
  } finally {
    await vite.close();
  }
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
  assert.match(
    cssSource,
    /\.barangay-heatmap-polygon:focus\s*\{[^}]*outline:\s*none\s*;/,
  );
  const focusVisibleStyles = cssSource.match(
    /\.barangay-heatmap-polygon:focus-visible\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(focusVisibleStyles);
  assert.match(focusVisibleStyles, /filter:\s*drop-shadow\([^;]*\)\s*;/);
  assert.doesNotMatch(focusVisibleStyles, /outline\s*:|stroke(?:-width|-dasharray)?\s*:/);
  assert.match(
    cssSource,
    /\.barangay-heatmap-polygon--selected\s*\{[^}]*stroke:\s*#17324d\s*;/,
  );
  assert.match(componentSource, /tabIndex=\{0\}/);
  assert.match(componentSource, /aria-pressed=\{isSelected\}/);
  assert.match(componentSource, /role="button"/);
  assert.match(componentSource, /stroke=\{\s*isSelected\s*\?\s*"#17324d"/);
  assert.match(componentSource, /strokeWidth=\{isSelected\s*\?\s*3\s*:\s*1\.25\}/);
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
