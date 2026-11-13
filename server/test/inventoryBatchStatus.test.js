const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getInventoryBatchStatus,
  isInventoryBatchExpired,
  isInventoryBatchLowStock,
  isInventoryBatchNearExpiry,
} = require("../src/utils/inventoryBatchStatus");

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

test("low stock uses the item's reorder level and total stock", () => {
  assert.equal(
    isInventoryBatchLowStock({
      quantityAvailable: 4,
      totalQuantityAvailable: 9,
      reorderLevel: 10,
    }),
    true,
  );
  assert.equal(
    isInventoryBatchLowStock({
      quantityAvailable: 4,
      totalQuantityAvailable: 11,
      reorderLevel: 10,
    }),
    false,
  );
});

test("depleted batches do not trigger low-stock or expiry status", () => {
  const expiredDate = getDateOnlyWithOffset(-1);

  assert.equal(
    getInventoryBatchStatus({
      quantityAvailable: 0,
      totalQuantityAvailable: 0,
      reorderLevel: 10,
      expirationDate: expiredDate,
    }),
    "DEPLETED",
  );
  assert.equal(isInventoryBatchExpired(expiredDate), true);
});

test("today is expired and only future dates within the threshold are near expiry", () => {
  const today = getDateOnlyWithOffset(0);
  const tomorrow = getDateOnlyWithOffset(1);
  const outsideThreshold = getDateOnlyWithOffset(31);

  assert.equal(isInventoryBatchExpired(today), true);
  assert.equal(isInventoryBatchNearExpiry(today, 30), false);
  assert.equal(isInventoryBatchNearExpiry(tomorrow, 30), true);
  assert.equal(isInventoryBatchNearExpiry(outsideThreshold, 30), false);
});

test("a positive batch without a reorder level remains available", () => {
  assert.equal(
    getInventoryBatchStatus({
      quantityAvailable: 2,
      totalQuantityAvailable: 2,
      reorderLevel: null,
      expirationDate: null,
    }),
    "AVAILABLE",
  );
});
