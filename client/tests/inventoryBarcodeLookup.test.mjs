import test from "node:test";
import assert from "node:assert/strict";

import { findInventoryItemBarcodeMatch } from "../src/features/inventory-items/inventoryBarcodeLookup.js";

test("canonical stock-form barcode wins over a stale item mirror", () => {
  const legacyItem = {
    id: "legacy-item",
    barcode: "12345678",
    is_active: true,
    stock_forms: [],
  };
  const canonicalItem = {
    id: "canonical-item",
    barcode: "12345678",
    is_active: true,
    stock_forms: [
      {
        id: "canonical-form",
        barcode: " 1234 5678 ",
        is_active: true,
      },
    ],
  };

  assert.deepEqual(
    findInventoryItemBarcodeMatch([legacyItem, canonicalItem], "12345678"),
    {
      item: canonicalItem,
      stockForm: canonicalItem.stock_forms[0],
    },
  );
});

test("legacy fallback refuses to choose among multiple active mirrors", () => {
  const items = [
    { id: "item-a", barcode: "00123456", is_active: true, stock_forms: [] },
    { id: "item-b", barcode: "00123456", is_active: true, stock_forms: [] },
  ];

  assert.deepEqual(findInventoryItemBarcodeMatch(items, "00 123 456"), {
    ambiguous: true,
  });
});

test("inactive canonical ownership blocks a legacy fallback", () => {
  const inactiveCanonicalItem = {
    id: "inactive-item",
    barcode: "12345678",
    is_active: true,
    stock_forms: [
      {
        id: "inactive-form",
        barcode: "12345678",
        is_active: false,
      },
    ],
  };
  const staleLegacyItem = {
    id: "stale-item",
    barcode: "12345678",
    is_active: true,
    stock_forms: [],
  };

  assert.deepEqual(
    findInventoryItemBarcodeMatch(
      [inactiveCanonicalItem, staleLegacyItem],
      "12345678",
    ),
    { inactive: true },
  );
});

test("inactive legacy ownership remains reserved when no canonical form matches", () => {
  const inactiveItem = {
    id: "inactive-item",
    barcode: "12345678",
    is_active: false,
    stock_forms: [],
  };

  assert.deepEqual(
    findInventoryItemBarcodeMatch([inactiveItem], "12 345 678"),
    { inactive: true },
  );
});

test("single legacy six-digit mirrors remain readable without numeric coercion", () => {
  const item = {
    id: "legacy-item",
    barcode: "001234",
    is_active: true,
    stock_forms: [],
  };

  const match = findInventoryItemBarcodeMatch([item], "00 1234");

  assert.equal(match.item, item);
  assert.equal(match.stockForm, null);
});
