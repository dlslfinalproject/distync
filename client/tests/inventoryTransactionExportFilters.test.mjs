import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");

let viteServer;
let exportInventoryTransactions;

before(async () => {
  viteServer = await createServer({
    root: clientRoot,
    configFile: false,
    appType: "custom",
    logLevel: "error",
  });

  ({ exportInventoryTransactions } = await viteServer.ssrLoadModule(
    "/src/features/inventory-transactions/inventoryTransactionService.js?inventory-export-filter-test",
  ));
});

after(async () => {
  await viteServer?.close();
});

test("inventory transaction export serializes every active filter", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      headers: {
        get: () => 'attachment; filename="inventory-transactions.csv"',
      },
      blob: async () => new Blob(["transaction"]),
    };
  };

  try {
    await exportInventoryTransactions("csv", {
      inventory_item_id: "item-1",
      inventory_batch_id: "batch-1",
      transaction_label: "Donation Adjustment",
      date_from: "2026-09-01",
      date_to: "2026-09-10",
      source: "Donors",
      search: "rice",
      movement: "OUTFLOW",
      stock_form_packaging: ["Box", "Bag"],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  const requestUrl = new URL(calls[0]);

  assert.equal(requestUrl.searchParams.get("format"), "csv");
  assert.equal(requestUrl.searchParams.get("inventory_item_id"), "item-1");
  assert.equal(requestUrl.searchParams.get("inventory_batch_id"), "batch-1");
  assert.equal(
    requestUrl.searchParams.get("transaction_label"),
    "Donation Adjustment",
  );
  assert.equal(requestUrl.searchParams.get("date_from"), "2026-09-01");
  assert.equal(requestUrl.searchParams.get("date_to"), "2026-09-10");
  assert.equal(requestUrl.searchParams.get("source"), "Donors");
  assert.equal(requestUrl.searchParams.get("search"), "rice");
  assert.equal(requestUrl.searchParams.get("movement"), "OUTFLOW");
  assert.deepEqual(
    requestUrl.searchParams.getAll("stock_form_packaging"),
    ["Box", "Bag"],
  );
});

test("inventory tracking page passes screen filters into export", async () => {
  const source = await fs.readFile(
    path.join(clientRoot, "src/pages/inventory/InventoryTransactionsPage.jsx"),
    "utf8",
  );
  const exportStart = source.indexOf(
    "const file = await exportInventoryTransactions(format, {",
  );
  const exportBlock = source.slice(exportStart, exportStart + 700);

  assert.notEqual(exportStart, -1);
  assert.match(exportBlock, /inventory_item_id: filters\.inventory_item_id/);
  assert.match(exportBlock, /inventory_batch_id: filters\.inventory_batch_id/);
  assert.match(exportBlock, /transaction_label: filters\.transaction_type/);
  assert.match(exportBlock, /date_from: filters\.date_from/);
  assert.match(exportBlock, /date_to: filters\.date_to/);
  assert.match(exportBlock, /source: filters\.source/);
  assert.match(exportBlock, /search: toolbarState\.search/);
  assert.match(exportBlock, /movement: toolbarState\.movement/);
  assert.match(exportBlock, /stock_form_packaging: toolbarState\.stockForms/);
});

test("inventory tracking summaries use filtered movement rows and scoped stock health", async () => {
  const source = await fs.readFile(
    path.join(clientRoot, "src/pages/inventory/InventoryTransactionsPage.jsx"),
    "utf8",
  );

  assert.match(source, /const summaryScopedBatches = useMemo\(\(\) =>/);
  assert.match(source, /const summaryScopedItems = useMemo\(\(\) =>/);
  assert.match(source, /const summaryScopedTransactions = useMemo\(\(\) =>/);

  const summaryStart = source.indexOf("const summaryMetrics = useMemo(() => {");
  const summaryBlock = source.slice(summaryStart, summaryStart + 7000);

  assert.notEqual(summaryStart, -1);
  assert.match(summaryBlock, /const totalInflow = displayedRows\.reduce\(/);
  assert.match(summaryBlock, /const totalOutflow = displayedRows\.reduce\(/);
  assert.match(summaryBlock, /const totalWriteOff = displayedRows\.reduce\(/);
  assert.match(summaryBlock, /summaryScopedItems\.filter\(/);
  assert.match(summaryBlock, /summaryTrackingMap\.get\(/);
});

test("inventory tracking local filters cover batch search, date validation, reset, and labels", async () => {
  const source = await fs.readFile(
    path.join(clientRoot, "src/pages/inventory/InventoryTransactionsPage.jsx"),
    "utf8",
  );
  const searchStart = source.indexOf("const searchableFields = [");
  const labelStart = source.indexOf("const getTransactionTypeLabel = (row) => {");

  assert.notEqual(searchStart, -1);
  assert.match(source.slice(searchStart, searchStart + 700), /row\.batch_no/);
  assert.match(source, /const DATE_RANGE_ERROR_MESSAGE =/);
  assert.match(source, /if \(hasInvalidDateRange\) \{\s*return \[\];/);
  assert.match(source, /T23:59:59\.999/);
  assert.match(source, /id="tracking-date-range-error"/);
  assert.match(source, /setFilters\(\{ \.\.\.EMPTY_TRANSACTION_FILTERS \}\)/);
  assert.match(source, /onClick=\{handleClearAllFilters\}/);
  assert.match(source, /\{ value: "Donated", label: "Donated" \}/);
  assert.doesNotMatch(source, /helper=/);

  assert.notEqual(labelStart, -1);
  const labelBlock = source.slice(labelStart, labelStart + 750);
  assert.match(labelBlock, /sourceLabel === "DONORS"/);
  assert.match(labelBlock, /referenceType === "DONATED"/);
});

test("inventory tracking stock cards scope current health to active result rows", async () => {
  const source = await fs.readFile(
    path.join(clientRoot, "src/pages/inventory/InventoryTransactionsPage.jsx"),
    "utf8",
  );

  assert.match(source, /const hasActiveDataFilters = Boolean\(/);
  assert.match(source, /const summaryResultScope = useMemo\(\(\) => \{/);
  assert.match(source, /displayedRows\.forEach\(\(row\) => \{/);
  assert.match(source, /summaryResultScope\.batchIds\.size/);
  assert.match(source, /return buildInventoryTrackingMap\(/);
  assert.match(source, /!isDateExpired\(trackedExpirationDate\)/);
  assert.match(source, /isItemExpiring\(trackedExpirationDate\)/);
  assert.match(source, /onHand > 0/);
});
