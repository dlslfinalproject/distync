import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryTrackingMap,
  getTrackedExpirationDate,
} from "../src/features/inventory-items/inventoryItemStockStatus.js";

const getDateOnlyWithOffset = (dayOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const buildTrackingStats = (item, batches) => {
  return buildInventoryTrackingMap([item], batches, []).get(item.id);
};

test("expiry tracking ignores depleted batches and stale item-level expiry", () => {
  const item = {
    id: "item-1",
    expiration_date: getDateOnlyWithOffset(-90),
    is_active: true,
  };
  const currentBatchExpiry = getDateOnlyWithOffset(60);
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 10,
      quantity_available: 0,
      expiration_date: getDateOnlyWithOffset(-1),
    },
    {
      inventory_item_id: item.id,
      quantity_received: 10,
      quantity_available: 10,
      expiration_date: currentBatchExpiry,
    },
  ]);

  assert.equal(trackingStats.hasBatchRecords, true);
  assert.equal(trackingStats.hasAvailableBatch, true);
  assert.equal(trackingStats.onHand, 10);
  assert.equal(trackingStats.expiredOnHand, 0);
  assert.equal(trackingStats.nearExpiryOnHand, 0);
  assert.equal(trackingStats.nearestExpirationDate, currentBatchExpiry);
  assert.equal(
    getTrackedExpirationDate(item, trackingStats),
    currentBatchExpiry,
  );
});

test("expiry tracking does not use an item expiry when its batches are depleted", () => {
  const item = {
    id: "item-2",
    expiration_date: getDateOnlyWithOffset(-30),
    is_active: true,
  };
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 5,
      quantity_available: 0,
      expiration_date: getDateOnlyWithOffset(-10),
    },
  ]);

  assert.equal(trackingStats.hasBatchRecords, true);
  assert.equal(trackingStats.hasAvailableBatch, false);
  assert.equal(trackingStats.expiredOnHand, 0);
  assert.equal(getTrackedExpirationDate(item, trackingStats), null);
});

test("expiry tracking still monitors positive-stock expired and near-expiry batches", () => {
  const item = {
    id: "item-3",
    expiration_date: null,
    is_active: true,
  };
  const expiredBatchExpiry = getDateOnlyWithOffset(-1);
  const nearExpiryBatchExpiry = getDateOnlyWithOffset(10);
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 4,
      quantity_available: 4,
      expiration_date: expiredBatchExpiry,
    },
    {
      inventory_item_id: item.id,
      quantity_received: 6,
      quantity_available: 6,
      expiration_date: nearExpiryBatchExpiry,
    },
  ]);

  assert.equal(trackingStats.onHand, 10);
  assert.equal(trackingStats.expiredOnHand, 4);
  assert.equal(trackingStats.nearExpiryOnHand, 6);
});

test("parent compatibility expiry is ignored without batch records", () => {
  const item = {
    id: "item-4",
    expiration_date: getDateOnlyWithOffset(-1),
    is_active: true,
  };
  const trackingStats = buildTrackingStats(item, []);

  assert.equal(trackingStats.hasBatchRecords, false);
  assert.equal(trackingStats.nearestExpirationDate, null);
  assert.equal(getTrackedExpirationDate(item, trackingStats), null);
});

test("parent compatibility expiry is ignored when all actual batches have null expiry", () => {
  const item = {
    id: "item-5",
    expiration_date: getDateOnlyWithOffset(-1),
    is_active: true,
  };
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 10,
      quantity_available: 10,
      expiration_date: null,
    },
  ]);

  assert.equal(trackingStats.hasBatchRecords, true);
  assert.equal(trackingStats.hasAvailableBatch, true);
  assert.equal(trackingStats.onHand, 10);
  assert.equal(trackingStats.nearestExpirationDate, null);
  assert.equal(getTrackedExpirationDate(item, trackingStats), null);
});

test("batch-only expiration remains authoritative across later restocks", () => {
  const item = {
    id: "item-6",
    expiration_date: getDateOnlyWithOffset(-365),
    is_active: true,
  };
  const firstBatchExpiry = getDateOnlyWithOffset(45);
  const laterBatchExpiry = getDateOnlyWithOffset(120);
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 10,
      quantity_available: 10,
      expiration_date: firstBatchExpiry,
    },
    {
      inventory_item_id: item.id,
      quantity_received: 5,
      quantity_available: 5,
      expiration_date: laterBatchExpiry,
    },
  ]);

  assert.equal(trackingStats.onHand, 15);
  assert.equal(trackingStats.totalReceived, 15);
  assert.equal(trackingStats.nearestExpirationDate, firstBatchExpiry);
  assert.equal(getTrackedExpirationDate(item, trackingStats), firstBatchExpiry);
});

test("a batch expiry is used when the parent compatibility field is null", () => {
  const item = {
    id: "item-7",
    expiration_date: null,
    is_active: true,
  };
  const batchExpiry = getDateOnlyWithOffset(45);
  const trackingStats = buildTrackingStats(item, [
    {
      inventory_item_id: item.id,
      quantity_received: 10,
      quantity_available: 10,
      expiration_date: batchExpiry,
    },
  ]);

  assert.equal(getTrackedExpirationDate(item, trackingStats), batchExpiry);
});

test("other write-offs are tracked as a separate loss category", () => {
  const item = {
    id: "item-8",
    expiration_date: null,
    is_active: true,
  };
  const trackingStats = buildInventoryTrackingMap(
    [item],
    [
      {
        inventory_item_id: item.id,
        quantity_received: 10,
        quantity_available: 7,
        expiration_date: null,
      },
    ],
    [
      {
        inventory_item: { id: item.id },
        transaction_type: "OTHER",
        quantity: 3,
      },
    ],
  ).get(item.id);

  assert.equal(trackingStats.other, 3);
});
