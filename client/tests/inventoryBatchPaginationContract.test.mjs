import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

const normalizeSource = (source) => source.replace(/\r\n/g, "\n");

test("Mayor Batches online live table opts into canonical server pagination", async () => {
  const [pageSource, tableSource, serviceSource] = await Promise.all([
    readSource("pages", "inventory", "InventoryBatchesPage.jsx"),
    readSource("components", "inventory-batches", "InventoryBatchesTable.jsx"),
    readSource("features", "inventory-batches", "inventoryBatchService.js"),
  ]);
  const normalizedPageSource = normalizeSource(pageSource);
  const normalizedTableSource = normalizeSource(tableSource);
  const normalizedServiceSource = normalizeSource(serviceSource);

  assert.match(normalizedPageSource, /fetchInventoryBatchesPage\(/);
  assert.match(normalizedPageSource, /page: activePage/);
  assert.match(normalizedPageSource, /pageSize: activePageSize/);
  assert.match(normalizedPageSource, /const \[currentPage, setCurrentPage\]/);
  assert.match(normalizedPageSource, /const \[pageSize, setPageSize\]/);
  assert.match(normalizedPageSource, /DEFAULT_TABLE_PAGE_SIZE/);
  assert.match(normalizedPageSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(normalizedPageSource, /includeItems: false/);
  assert.match(normalizedPageSource, /setCurrentPage\(1\)/);
  assert.match(normalizedPageSource, /isPaginatedLiveTable/);
  assert.match(normalizedPageSource, /isUsingCachedBatches/);
  assert.match(normalizedPageSource, /isMountedRef/);
  assert.match(normalizedPageSource, /isOnline \|\|/);
  assert.match(normalizedPageSource, /trigger: "online"/);
  assert.match(normalizedPageSource, /trigger: "sync-finished"/);
  assert.match(normalizedPageSource, /trigger: "mutation"/);
  assert.doesNotMatch(normalizedPageSource, /setInterval\(/);
  assert.doesNotMatch(normalizedPageSource, /addEventListener\("focus"/);
  assert.doesNotMatch(normalizedPageSource, /visibilitychange/);

  assert.match(normalizedTableSource, /import TablePagination/);
  assert.match(normalizedTableSource, /<TablePagination/);
  assert.match(normalizedTableSource, /TABLE_PAGE_SIZE_OPTIONS/);
  assert.match(normalizedTableSource, /ariaLabel="Inventory batches pagination"/);
  assert.doesNotMatch(normalizedTableSource, /paginateRows\(/);

  assert.match(normalizedServiceSource, /export const fetchInventoryBatchesPage/);
  assert.match(normalizedServiceSource, /searchParams\.set\("page", String\(filters\.page\)\)/);
  assert.match(
    normalizedServiceSource,
    /searchParams\.set\("pageSize", String\(filters\.pageSize\)\)/,
  );
  assert.match(normalizedServiceSource, /if \(!hasPage && !hasPageSize\)/);
});

test("complete batch callers stay on the legacy unpaginated array contract", async () => {
  const sources = await Promise.all([
    readSource("offline", "mayorInventoryPreparation.js"),
    readSource("features", "inventory-distribution", "useInventoryDistributionReadiness.js"),
    readSource("pages", "inventory", "ReliefPackTemplatesPage.jsx"),
    readSource("pages", "inventory", "InventoryItemsPage.jsx"),
    readSource("pages", "inventory", "InventoryTransactionsPage.jsx"),
    readSource("features", "inventory-batches", "inventoryBatchService.js"),
  ]);

  for (const source of sources.slice(0, 5)) {
    assert.match(source, /fetchInventoryBatches\(\)/);
    assert.doesNotMatch(source, /fetchInventoryBatches\(\{[\s\S]*page/);
  }

  const serviceSource = sources[5];
  const exportStart = serviceSource.indexOf("export const exportInventoryBatches");
  const exportEnd = serviceSource.indexOf("export const createInventoryBatch", exportStart);
  const exportSource = serviceSource.slice(exportStart, exportEnd);
  assert.doesNotMatch(exportSource, /page|pageSize/);
});

test("batch live search fields and server filters remain aligned", async () => {
  const [pageSource, repositorySource] = await Promise.all([
    readSource("pages", "inventory", "InventoryBatchesPage.jsx"),
    fs.readFile(
      path.resolve(process.cwd(), "../server/src/repositories/inventoryBatch.repository.js"),
      "utf8",
    ),
  ]);

  for (const field of [
    "batch_no",
    "storage_location",
    "item_name",
    "item_code",
  ]) {
    assert.match(repositorySource, new RegExp(field));
  }

  assert.match(pageSource, /inventory_item_id/);
  assert.match(pageSource, /source_type/);
  assert.match(pageSource, /status/);
  assert.match(repositorySource, /ib\.inventory_item_id/);
  assert.match(repositorySource, /ib\.source_type/);
  assert.match(repositorySource, /ib\.status/);
  assert.match(repositorySource, /is_expiring/);
  assert.match(repositorySource, /is_expired/);
});
