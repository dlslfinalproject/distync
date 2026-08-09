import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidInventoryTransactionReferenceNo,
  normalizeInventoryTransactionReferenceNo,
} from "../src/features/inventory-transactions/inventoryTransactionReference.js";

test("client ITR helper mirrors trim-uppercase and format validation", () => {
  assert.equal(
    normalizeInventoryTransactionReferenceNo(" itr-2026-000123 "),
    "ITR-2026-000123",
  );
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2026-000123"), true);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2025-000123"), true);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2026-000000"), false);
  assert.equal(isValidInventoryTransactionReferenceNo("ITR-2026-123"), false);
});
