import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DISASTER_EVENT_STATUSES,
  getInventoryDistributionStubDashboardBarangayIds,
  INVENTORY_DISTRIBUTION_VIEW_TABS,
  shouldLoadInventoryDistributionStubDashboard,
} from "../src/features/inventory-distribution/inventoryDistributionDataSource.js";

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

const affectedBarangays = Array.from({ length: 5 }, (_value, index) => ({
  id: `barangay-${index + 1}`,
}));

test("ended Inventory Distribution views never request Stub-dashboard data", () => {
  assert.equal(
    shouldLoadInventoryDistributionStubDashboard({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ENDED,
      disasterEventStatus: DISASTER_EVENT_STATUSES.CLOSED,
    }),
    false,
  );
  assert.deepEqual(
    getInventoryDistributionStubDashboardBarangayIds({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ENDED,
      disasterEventStatus: DISASTER_EVENT_STATUSES.CLOSED,
      selectedBarangayId: "barangay-1",
      selectableBarangays: affectedBarangays,
    }),
    [],
  );
  assert.deepEqual(
    getInventoryDistributionStubDashboardBarangayIds({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ENDED,
      disasterEventStatus: DISASTER_EVENT_STATUSES.CLOSED,
      selectableBarangays: affectedBarangays,
    }),
    [],
  );
});

test("active Inventory Distribution request cardinality remains unchanged", () => {
  assert.equal(
    shouldLoadInventoryDistributionStubDashboard({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE,
      disasterEventStatus: DISASTER_EVENT_STATUSES.ACTIVE,
    }),
    true,
  );
  assert.deepEqual(
    getInventoryDistributionStubDashboardBarangayIds({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE,
      disasterEventStatus: DISASTER_EVENT_STATUSES.ACTIVE,
      selectedBarangayId: "barangay-1",
      selectableBarangays: affectedBarangays,
    }),
    ["barangay-1"],
  );
  assert.deepEqual(
    getInventoryDistributionStubDashboardBarangayIds({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE,
      disasterEventStatus: DISASTER_EVENT_STATUSES.ACTIVE,
      selectableBarangays: affectedBarangays,
    }),
    affectedBarangays.map((barangay) => barangay.id),
  );
});

test("only the explicit ACTIVE view and ACTIVE event status enable Stub-dashboard loading", () => {
  assert.equal(
    shouldLoadInventoryDistributionStubDashboard({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ENDED,
      disasterEventStatus: DISASTER_EVENT_STATUSES.ACTIVE,
    }),
    false,
  );
  assert.equal(
    shouldLoadInventoryDistributionStubDashboard({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE,
      disasterEventStatus: DISASTER_EVENT_STATUSES.CLOSED,
    }),
    false,
  );
  assert.equal(
    shouldLoadInventoryDistributionStubDashboard({
      activeTab: INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE,
      disasterEventStatus: "PLANNED",
    }),
    false,
  );
});

test("the hook gates Stub loading before selected/all-Barangay fan-out and preserves source semantics", async () => {
  const source = await readSource(
    "../src/features/inventory-distribution/useInventoryDistribution.js",
  );

  assert.match(source, /getInventoryDistributionStubDashboardBarangayIds/);
  assert.match(
    source,
    /disasterEventStatus:\s*selectedDisasterEvent\?\.status/,
  );
  assert.match(
    source,
    /if \(!selectedDisasterEventId \|\| requestedBarangayIds\.length === 0\) \{[\s\S]*?setStubDashboardPayload\(emptyStubDashboardPayload\);[\s\S]*?return;[\s\S]*?\}/,
  );
  assert.match(source, /selectableBarangays\.map\(\(barangay\) =>/);
  assert.match(
    source,
    /activeTab === "ended"\s*\?\s*masterlistDistributionRows\s*:/,
  );
  assert.match(source, /const stub = household\?\.stub \|\| null;/);
  assert.match(source, /const status = stub\?\.status \|\| "";/);
  assert.match(source, /let isMounted = true;/);
  assert.match(source, /isMounted = false;/);
  assert.match(source, /selectedDisasterEvent\?\.status,\s*selectedDisasterEventId/);
  assert.doesNotMatch(source, /fetchBarangayStubDashboard\(\{[\s\S]*?page:/);
  assert.doesNotMatch(source, /fetchBarangayStubDashboard\(\{[\s\S]*?pageSize:/);
});
