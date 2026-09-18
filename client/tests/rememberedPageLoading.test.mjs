import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = async (...segments) =>
  fs.readFile(new URL(`../${segments.join("/")}`, import.meta.url), "utf8");

test("role dashboard pages suppress only repeat-visit initial loading", async () => {
  const helperSource = await readSource("src", "utils", "rememberedPageLoading.js");
  const pagePaths = [
    ["src", "pages", "mswdo", "AnalyticsDashboardPage.jsx"],
    ["src", "pages", "mswdo", "ConsolidatedMasterlistPage.jsx"],
    ["src", "pages", "mswdo", "StubDistributionPage.jsx"],
    ["src", "pages", "mswdo", "DisasterEventsPage.jsx"],
    ["src", "pages", "mswdo", "DisasterEventReportsPage.jsx"],
    ["src", "pages", "mswdo", "AnomalyTrackingPage.jsx"],
    ["src", "pages", "DistributionHistoryPage.jsx"],
    ["src", "pages", "SyncManagementPage.jsx"],
    ["src", "pages", "inventory", "InventoryItemsPage.jsx"],
    ["src", "pages", "inventory", "InventoryBatchesPage.jsx"],
    ["src", "pages", "inventory", "InventoryTransactionsPage.jsx"],
    ["src", "pages", "inventory", "InventoryDistributionPage.jsx"],
    ["src", "pages", "inventory", "InventoryForecastsPage.jsx"],
    ["src", "pages", "inventory", "ReliefPackTemplatesPage.jsx"],
    ["src", "pages", "inventory", "NotificationCenterPage.jsx"],
    ["src", "pages", "DonationManagementPage.jsx"],
    ["src", "pages", "SystemLogReviewPage.jsx"],
  ];
  const pageSources = await Promise.all(pagePaths.map((path) => readSource(...path)));

  assert.match(helperSource, /const completedPageLoadKeys = new Set\(\)/);
  assert.match(helperSource, /observedLoadingRef\.current/);
  assert.match(helperSource, /!wasLoadedBeforeMountRef\.current/);
  assert.equal(
    pageSources.filter((source) => /useRememberedInitialLoading/.test(source)).length,
    pagePaths.length,
  );
});
