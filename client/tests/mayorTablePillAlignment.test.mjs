import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

test("Mayor table pill columns keep headers and values centered", async () => {
  const [
    batchTable,
    itemDetail,
    transactionTable,
    distributionTable,
    itemTable,
    reliefPackPage,
    forecastPanel,
    syncPage,
    distributionHistoryPage,
    anomalyPage,
  ] = await Promise.all([
    readSource("components", "inventory-batches", "InventoryBatchesTable.jsx"),
    readSource("components", "inventory-items", "InventoryItemDetailModal.jsx"),
    readSource(
      "components",
      "inventory-transactions",
      "InventoryTransactionsTable.jsx",
    ),
    readSource(
      "components",
      "inventory-distribution",
      "InventoryDistributionTable.jsx",
    ),
    readSource("components", "inventory-items", "InventoryItemsTable.jsx"),
    readSource("pages", "inventory", "ReliefPackTemplatesPage.jsx"),
    readSource("components", "inventory-items", "ForecastingPanel.jsx"),
    readSource("pages", "SyncManagementPage.jsx"),
    readSource("pages", "DistributionHistoryPage.jsx"),
    readSource("pages", "mswdo", "AnomalyTrackingPage.jsx"),
  ]);

  assert.match(batchTable, /centeredHeaderCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(batchTable, /Status[\s\S]*?centeredHeaderCell/);
  assert.match(batchTable, /Sync[\s\S]*?centeredHeaderCell/);
  assert.match(batchTable, /centeredBodyCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(batchTable, /getStatusBadgeStyles\(row\.status\)/);
  assert.match(batchTable, /SyncStatusBadge status=\{row\.sync_status\}/);

  assert.match(itemDetail, /centeredHeaderCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(itemDetail, /Status[\s\S]*?centeredHeaderCell/);
  assert.match(itemDetail, /centeredHeaderCell[\s\S]*?Action\s*<\/th>/);
  assert.match(itemDetail, /centeredBodyCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(itemDetail, /getBatchStatusStyle\(batchStatus\)/);

  assert.match(transactionTable, /Movement<\/th>[\s\S]*?centerCell/);
  assert.match(transactionTable, /getDirectionStyles\(row\.transaction_direction\)/);
  assert.match(distributionTable, /inventory-distribution-status-cell[\s\S]*?statusCell/);
  assert.match(distributionTable, /inventory-distribution-status-badge/);
  assert.match(itemTable, /centeredHeaders = new Set\([\s\S]*?Stock Forms[\s\S]*?Stock Status/);
  assert.match(itemTable, /<div style=\{styles\.pillWrap\}>/);

  assert.match(reliefPackPage, /headerCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(reliefPackPage, /bodyCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(reliefPackPage, /mayor-relief-pack-template-rule-chip/);
  assert.match(reliefPackPage, /mayor-relief-pack-template-applies-chip/);
  assert.match(reliefPackPage, /<StatusPill[\s\S]*?mayor-relief-pack-template-status-cell/);

  assert.match(forecastPanel, /th: \{[\s\S]*?textAlign: "center"/);
  assert.match(forecastPanel, /td: \{[\s\S]*?textAlign: "center"/);
  assert.match(forecastPanel, /getRiskLevelStyle\(row\.risk_level\)/);
  assert.match(forecastPanel, /getRiskLevelStyle\(result\.risk_level\)/);

  assert.match(syncPage, /syncStatusHeaderStyles = \{[\s\S]*?textAlign: "center"/);
  assert.match(syncPage, /syncStatusCellStyles = \{[\s\S]*?textAlign: "center"/);
  assert.match(syncPage, /<SyncStatusBadge/);

  assert.match(
    anomalyPage,
    /reviewStatus: \{[\s\S]*?textAlign: "center"[\s\S]*?\}/,
  );
  assert.match(anomalyPage, /reviewStatus[\s\S]*?<StatusPill row=\{row\}/);

  assert.match(
    distributionHistoryPage,
    /<th style=\{\{ \.\.\.tableStyles\.th, textAlign: "center" \}\}>Status<\/th>/,
  );
  assert.match(distributionHistoryPage, /borderRadius: "999px"/);
  assert.match(
    distributionHistoryPage,
    /<td style=\{\{ \.\.\.tableStyles\.td, textAlign: "center", verticalAlign: "middle" \}\}>/,
  );
});
