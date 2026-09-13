import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Mayor inventory forecasting keeps route, service endpoints, and forecast semantics unchanged", async () => {
  const [routesSource, pageSource, hookSource, serviceSource, panelSource] =
    await Promise.all([
      readSource(["routes", "AppRoutes.jsx"]),
      readSource(["pages", "inventory", "InventoryForecastsPage.jsx"]),
      readSource(["features", "inventory-items", "useInventoryForecast.js"]),
      readSource(["features", "inventory-items", "inventoryItemService.js"]),
      readSource(["components", "inventory-items", "ForecastingPanel.jsx"]),
    ]);

  assert.match(routesSource, /path: "forecasts", element: <InventoryForecastsPage \/>/);
  assert.match(pageSource, /title="INVENTORY FORECASTING MANAGEMENT"/);
  assert.match(hookSource, /selectedForecastModel[\s\S]*useState\("MOVING_AVERAGE"\)/);
  assert.match(serviceSource, /\/api\/v1\/inventory-items\/forecast\/run/);
  assert.match(serviceSource, /\/api\/v1\/inventory-items\/forecast\/latest/);
  assert.match(serviceSource, /\/api\/v1\/inventory-items\/forecast\/context/);
  assert.match(serviceSource, /\/api\/v1\/inventory-items\/forecast\/history/);
  assert.doesNotMatch(panelSource, /fetch\(|axios|\/api\/v1/);
  assert.doesNotMatch(panelSource, /FORECAST_HORIZON_DAYS|lookback_days|moving_average_window|exponential_smoothing_alpha/);
  assert.doesNotMatch(panelSource, /onClearFilters|mayor-inventory-forecast-filter-actions|Clear filters/);
  assert.match(panelSource, /inventory_item_count/);
  assert.match(panelSource, /active_inventory_item_count/);
  assert.match(
    panelSource,
    /canonicalCount !== undefined[\s\S]*canonicalCount !== null[\s\S]*\? canonicalCount[\s\S]*summary\?\.active_inventory_item_count/,
  );
  assert.doesNotMatch(panelSource, /No active inventory items/);
});

test("Mayor inventory forecasting controls, KPIs, charts, and tables expose mobile-safe layout primitives", async () => {
  const [panelSource, modalSource, cssSource] = await Promise.all([
    readSource(["components", "inventory-items", "ForecastingPanel.jsx"]),
    readSource(["components", "inventory-items", "InventoryForecastExportModal.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(panelSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(100%, 220px\), 1fr\)\)"/);
  assert.match(panelSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(100%, 150px\), 1fr\)\)"/);
  assert.match(panelSource, /className="mayor-inventory-forecast-stat-grid"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.mayor-inventory-forecast-stat-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(panelSource, /minHeight: "clamp\(220px, 46vw, 280px\)"/);
  assert.match(panelSource, /aria-label="Inventory usage trend chart"/);
  assert.match(panelSource, /role="img"/);
  assert.match(panelSource, /overflowX: "auto"/);
  assert.doesNotMatch(panelSource, /overflowX:\s*"hidden"/);
  assert.match(panelSource, /stockActionColumnWidths/);
  assert.match(panelSource, /detailedColumnWidths/);
  assert.match(panelSource, /Forecast Need/);
  assert.match(panelSource, /After Forecast/);
  assert.match(panelSource, /Detailed Results by Item/);
  assert.match(panelSource, /Forecast Run History/);
  assert.match(panelSource, /overflowWrap: "anywhere"/);

  assert.match(modalSource, /padding: "clamp\(12px, 4vw, 24px\)"/);
  assert.match(modalSource, /fontSize: "clamp\(21px, 5vw, 26px\)"/);
  assert.match(modalSource, /maxHeight: "min\(90vh, 720px\)"/);
  assert.match(modalSource, /id="forecast-export-event"/);
});

