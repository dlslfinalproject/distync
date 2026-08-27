import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesInventoryItemCategory,
  matchesInventoryItemSearch,
} from "../src/features/inventory-items/inventoryItemFilters.js";

const inventoryItem = {
  item_name: "Premium Rice",
  item_code: "RICE-001",
  barcode: "4801234567890",
  category: "Perishable",
  unit_of_measure: "kg",
  packaging: "sack",
  stock_forms: [
    {
      barcode: "4801234567891",
      packaging: "box",
      units_per_packaging: 12,
      unit_of_measure: "pc",
      unit_of_measure_value: 1,
      is_active: true,
    },
  ],
};

test("inventory item search matches item and packaging identifiers", () => {
  assert.equal(matchesInventoryItemSearch(inventoryItem, "premium"), true);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "rice-001"), true);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "4801234567890"), true);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "4801234567891"), true);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "box"), true);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "not present"), false);
  assert.equal(matchesInventoryItemSearch(inventoryItem, "   "), true);
});

test("inventory item category filter is case and format insensitive", () => {
  assert.equal(matchesInventoryItemCategory(inventoryItem, "All"), true);
  assert.equal(matchesInventoryItemCategory(inventoryItem, "perishable"), true);
  assert.equal(matchesInventoryItemCategory(inventoryItem, "Non-Perishable"), false);
  assert.equal(
    matchesInventoryItemCategory(
      { item_name: "Canned Goods", category: "non_perishable" },
      "Non-Perishable",
    ),
    true,
  );
});

test("inventory item category filter falls back to the perishable flag", () => {
  assert.equal(
    matchesInventoryItemCategory(
      { item_name: "Fresh Vegetables", is_perishable: true },
      "Perishable",
    ),
    true,
  );
  assert.equal(
    matchesInventoryItemCategory(
      { item_name: "Canned Goods", is_perishable: "false" },
      "Non-Perishable",
    ),
    true,
  );
});
