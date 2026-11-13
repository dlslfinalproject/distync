import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readSource = (relativePath) =>
  readFile(resolve(projectRoot, relativePath), "utf8");

test("remembered loading requires usable current data before showing an empty state", async () => {
  const helper = await readSource("src/utils/rememberedPageLoading.js");
  const inventoryItemsPage = await readSource(
    "src/pages/inventory/InventoryItemsPage.jsx",
  );
  const inventoryItemsTable = await readSource(
    "src/components/inventory-items/InventoryItemsTable.jsx",
  );

  assert.match(helper, /hasUsableData = false/);
  assert.match(
    helper,
    /return Boolean\(isLoading\) && !errorMessage && !Boolean\(hasUsableData\)/,
  );
  assert.match(inventoryItemsPage, /hasUsableData: inventoryItems\.length > 0/);
  assert.match(
    inventoryItemsTable,
    /isLoading \? \([\s\S]*Loading inventory items\.\.\.[\s\S]*safeRows\.length === 0 \?/,
  );
});

test("Barangay masterlist marks an uncached selected-event request as loading immediately", async () => {
  const source = await readSource("src/features/masterlist/masterlistHooks.js");

  assert.match(
    source,
    /useState\(\s*\(\) => Boolean\(disasterEventId && !initialCacheEntry\),\s*\)/,
  );
});

test("MSWDO analytics does not show confirmed empty data while filters are pending", async () => {
  const source = await readSource(
    "src/pages/mswdo/AnalyticsDashboardPage.jsx",
  );

  assert.match(
    source,
    /hasSelectedEvent &&\s*!isInitialLoadingFilters &&\s*!isInitialLoadingDashboard &&\s*!errorMessage &&\s*!hasData/,
  );
});

test("Mayor forecasting distinguishes pending event loading from confirmed zero events", async () => {
  const hook = await readSource(
    "src/features/inventory-items/useInventoryForecast.js",
  );
  const panel = await readSource(
    "src/components/inventory-items/ForecastingPanel.jsx",
  );

  assert.match(hook, /const \[isForecastEventsLoading, setIsForecastEventsLoading\]/);
  assert.match(hook, /isInitialForecastEventsLoading/);
  assert.match(
    panel,
    /isForecastEventsLoading \? \(\s*<option value="">Loading active disaster events\.\.\.<\/option>/,
  );
  assert.match(panel, /No active disaster events available/);
});
