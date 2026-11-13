import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (...segments) => fs.readFile(sourcePath(...segments), "utf8");

const sliceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  return source.slice(start, end < 0 ? source.length : end);
};

test("STAGE3-01 Add Item keeps an opening-batch expiration control", async () => {
  const source = await readSource(
    "components",
    "inventory-items",
    "InventoryItemFormModal.jsx",
  );

  assert.match(source, /id="expiration_date"/);
  assert.match(source, /Batch Expiration Date/);
  assert.match(
    source,
    /expiration_date:\s*isEditMode\s*\?\s*""\s*:/,
  );
  assert.match(source, /!isEditMode && resolvedIsPerishable/);
});

test("STAGE3-02 current Edit Item payload omits parent expiration while create retains it", async () => {
  const source = await readSource(
    "components",
    "inventory-items",
    "InventoryItemFormModal.jsx",
  );
  const submitSource = sliceBetween(
    source,
    "const handleSubmit =",
    "const handleCancel =",
  );

  assert.match(submitSource, /\.\.\.formValues/);
  assert.match(submitSource, /if \(isEditMode\)/);
  assert.match(submitSource, /delete normalizedFormValues\.expiration_date/);
  assert.match(submitSource, /normalizedFormValues\.expiration_date\s*=\s*isBlank/);
});

test("STAGE3-03 online item updates strip legacy parent-expiration aliases", async () => {
  const source = await readSource(
    "features",
    "inventory-items",
    "inventoryItemService.js",
  );
  const updateSource = sliceBetween(
    source,
    "export const updateInventoryItem",
    "export const runInventoryForecast",
  );

  assert.match(source, /export const buildInventoryItemUpdatePayload/);
  assert.match(source, /expiration_date:\s*_legacyExpirationDate/);
  assert.match(source, /expiryDate:\s*_legacyExpiryDate/);
  assert.match(updateSource, /payload:\s*normalizedPayload/);
  assert.match(updateSource, /JSON\.stringify\(normalizedPayload\)/);
  assert.doesNotMatch(updateSource, /expiration_date/);
});

test("STAGE3-04 offline item CREATE retains opening-batch expiration", async () => {
  const [serviceSource, itemSyncSource, offlineModelSource] = await Promise.all([
    readSource("features", "inventory-items", "inventoryItemService.js"),
    readSource("features", "inventory-items", "inventoryItemSync.js"),
    readSource("offline", "mayorInventoryOfflineModel.js"),
  ]);
  const createSource = sliceBetween(
    serviceSource,
    "export const createInventoryItem",
    "export const buildInventoryItemUpdatePayload",
  );

  assert.match(createSource, /actionKey: "INVENTORY_ITEM_CREATE"/);
  assert.match(createSource, /payload,/);
  assert.match(createSource, /JSON\.stringify\(payload\)/);
  assert.match(itemSyncSource, /expiration_date: payload\.expiration_date/);
  assert.match(
    offlineModelSource,
    /buildQueuedInventoryItemOpeningBatch[\s\S]*?expiration_date: payload\.expiration_date/,
  );
});

test("STAGE3-05 legacy offline item updates remain visible without current generation", async () => {
  const [serviceSource, offlineModelSource] = await Promise.all([
    readSource("features", "inventory-items", "inventoryItemService.js"),
    readSource("offline", "mayorInventoryOfflineModel.js"),
  ]);
  const updateSource = sliceBetween(
    serviceSource,
    "export const updateInventoryItem",
    "export const runInventoryForecast",
  );

  assert.match(updateSource, /performOnlineOnlyMutation/);
  assert.doesNotMatch(updateSource, /expiration_date/);
  assert.match(offlineModelSource, /"INVENTORY_ITEM_UPDATE"/);
  assert.match(offlineModelSource, /legacy queued edits visible/);
});

test("STAGE3-06 current status tracking remains batch-only", async () => {
  const source = await readSource(
    "features",
    "inventory-items",
    "inventoryItemStockStatus.js",
  );

  assert.doesNotMatch(source, /item\??\.expiration_date/);
  assert.match(source, /isItemExpiring\(batch\.expiration_date\)/);
  assert.match(source, /getTrackedExpirationDate = \(_item,/);
  assert.match(source, /!trackingStats\.hasBatchRecords \|\| !trackingStats\.hasAvailableBatch/);
});

test("STAGE3-07 transactions preserve batch expiry without item-parent fallback", async () => {
  const source = await readSource(
    "pages",
    "inventory",
    "InventoryTransactionsPage.jsx",
  );
  const rowSource = sliceBetween(
    source,
    "const mergedTransactionRows = useMemo",
    "const displayedRows = useMemo",
  );

  assert.match(rowSource, /row\.inventory_batch\?\.expiration_date/);
  assert.match(rowSource, /linkedBatch\?\.expiration_date/);
  assert.doesNotMatch(rowSource, /row\.inventory_item\??\.expiration_date/);
});

test("STAGE3-08 persisted donation editing uses batch expiry only", async () => {
  const source = await readSource(
    "features",
    "donations",
    "useDonationManagementModals.js",
  );
  const savedDetailsSource = sliceBetween(
    source,
    "const resolveSavedDonationItemStockDetails",
    "const resolveDonationInventoryItem",
  );
  const existingPayloadSource = sliceBetween(
    source,
    "const buildExistingLooseDonationItemPayload",
    "const buildExistingReliefPackDonationItemPayloads",
  );

  assert.match(savedDetailsSource, /batch\.expiration_date/);
  assert.doesNotMatch(savedDetailsSource, /item\??\.expiration_date/);
  assert.match(existingPayloadSource, /item\.inventory_batch\?\.expiration_date/);
  assert.doesNotMatch(existingPayloadSource, /item\.expiration_date/);
});

test("STAGE3-09 donation staging still carries expiration as batch input", async () => {
  const source = await readSource(
    "features",
    "donations",
    "useDonationManagementModals.js",
  );
  const submissionSource = sliceBetween(
    source,
    "const buildDonationItemSubmissionPayload",
    "const buildLooseDonationDraft",
  );

  assert.match(submissionSource, /expiration_date: item\.expiration_date/);
  assert.match(source, /expiration_date: draft\.expiration_date \|\| null/);
  assert.match(source, /reliefPackExpirationDate/);
});

test("STAGE3-10 raw conflict payloads retain legacy expiration compatibility", async () => {
  const source = await readSource("pages", "SyncManagementPage.jsx");
  const itemCorrectionSource = sliceBetween(
    source,
    "const getConflictCorrectionItemData",
    "const getFirstNumericConflictValue",
  );
  const batchCorrectionSource = sliceBetween(
    source,
    "const getConflictCorrectionBatchData",
    "const fieldStyles",
  );

  assert.match(itemCorrectionSource, /payload\.expiration_date/);
  assert.match(itemCorrectionSource, /payload\.expiryDate/);
  assert.match(batchCorrectionSource, /localPayload\.expiration_date/);
});

test("STAGE3-11 cached parent metadata is tolerated but cannot become current expiry", async () => {
  const [{
    buildMayorInventoryItemDetailFromLocalGraph,
    buildQueuedInventoryItemOpeningBatch,
  }, {
    buildInventoryTrackingMap,
    getTrackedExpirationDate,
  }] = await Promise.all([
    import("../src/offline/mayorInventoryOfflineModel.js"),
    import("../src/features/inventory-items/inventoryItemStockStatus.js"),
  ]);
  const legacyItem = {
    id: "legacy-item",
    item_name: "Legacy Rice",
    expiration_date: "2024-01-01",
    stock_forms: [{ id: "legacy-form", packaging: "piece", units_per_packaging: 1 }],
  };
  const detail = buildMayorInventoryItemDetailFromLocalGraph({
    inventoryItemId: legacyItem.id,
    inventoryItems: [legacyItem],
    inventoryBatches: [],
    inventoryTransactions: [],
  });
  const trackingStats = buildInventoryTrackingMap([detail.item], [], []).get(
    legacyItem.id,
  );
  const openingBatch = buildQueuedInventoryItemOpeningBatch(
    {
      entityLocalId: legacyItem.id,
      clientTimestamp: "2026-09-10T00:00:00.000Z",
      payload: {
        packaging: "piece",
        packaging_count: 1,
        quantity: 1,
        expiration_date: "2027-05-31",
      },
    },
    [legacyItem],
  );

  assert.equal(detail.item.expiration_date, "2024-01-01");
  assert.equal(getTrackedExpirationDate(detail.item, trackingStats), null);
  assert.equal(openingBatch.expiration_date, "2027-05-31");
});
