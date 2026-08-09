import test from "node:test";
import assert from "node:assert/strict";

import {
  matchesInventoryDistributionFilters,
  matchesInventoryDistributionSearch,
} from "../src/features/inventory-distribution/inventoryDistributionFilters.js";

const claimedRow = {
  family_head_name: "Maria Santos",
  address: "Barangay Poblacion",
  barangay_name: "Poblacion",
  family_members_count: 5,
  sectors_text: "Senior Citizen, Pregnant Woman",
  sector_ids: ["SENIOR_CITIZEN", "PREGNANT_WOMAN"],
  distribution_status: "CLAIMED",
  distribution_status_label: "Claimed",
  relief_pack_name: "Family Food Pack",
  relief_pack_templates: [
    {
      name: "Standard Relief Pack",
      items: [{ inventory_item: { item_name: "Rice" } }],
    },
  ],
  donated_relief_packs: [{ name: "Hygiene Kit", donor_name: "Local Donor" }],
  donated_loose_items: [
    { inventory_item_name: "Bottled Water", donor_name: "Volunteer Group" },
  ],
};

const issuedRow = {
  family_head_name: "Juan Dela Cruz",
  address: "Barangay San Andres",
  barangay_name: "San Andres",
  family_members_count: 3,
  sectors_text: "Solo Parent",
  sector_ids: ["SOLO_PARENT"],
  distribution_status: "ISSUED",
  distribution_status_label: "For Claim",
  relief_pack_name: "Family Food Pack",
  relief_pack_templates: [],
  donated_relief_packs: [],
  donated_loose_items: [],
};

test("Inventory Distribution search matches values displayed in the table", () => {
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "maria"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "poblacion"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "senior"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "claimed"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "rice"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "hygiene"), true);
  assert.equal(matchesInventoryDistributionSearch(claimedRow, "not present"), false);
});

test("Inventory Distribution status filter keeps only matching table rows", () => {
  assert.equal(matchesInventoryDistributionFilters(claimedRow, "", []), true);
  assert.equal(matchesInventoryDistributionFilters(claimedRow, "CLAIMED", []), true);
  assert.equal(matchesInventoryDistributionFilters(claimedRow, "ISSUED", []), false);
  assert.equal(matchesInventoryDistributionFilters(issuedRow, "ISSUED", []), true);
  assert.equal(matchesInventoryDistributionFilters(issuedRow, "CLAIMED", []), false);
});

test("Inventory Distribution filter button sector options narrow displayed rows", () => {
  assert.equal(
    matchesInventoryDistributionFilters(claimedRow, "", ["SENIOR_CITIZEN"]),
    true,
  );
  assert.equal(
    matchesInventoryDistributionFilters(claimedRow, "", ["SOLO_PARENT"]),
    false,
  );
  assert.equal(
    matchesInventoryDistributionFilters(issuedRow, "ISSUED", ["SOLO_PARENT"]),
    true,
  );
});
