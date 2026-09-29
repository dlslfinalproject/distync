import assert from "node:assert/strict";
import test from "node:test";
import {
  activateStubDashboardMemoryOwner,
  buildStubDashboardRequestKey,
  clearStubDashboardMemoryCache,
  getStubDashboardCacheEntry,
  setStubDashboardCacheEntry,
} from "../src/features/stubs/stubDashboardMemoryCache.mjs";

const request = {
  userId: "synthetic-user-a",
  disasterEventId: "event-y",
  overrideBarangayId: "",
  allowFallback: false,
  assignedBarangayId: "barangay-x",
  page: 1,
  pageSize: 25,
  search: "",
  status: "all",
  selectedSectorIds: [],
  sortOrder: "oldest",
};

const actor = (userId, accessMode = "DEMO") => ({
  accessMode,
  userId,
  roleCode: "BARANGAY",
});

const keyFor = (actorContext) =>
  buildStubDashboardRequestKey({ ...request, actorContext });

test("stub dashboard memory cache cannot cross user or access mode", () => {
  assert.notEqual(keyFor(actor("synthetic-user-a")), keyFor(actor("synthetic-user-b")));
  assert.notEqual(
    keyFor(actor("synthetic-user-a", "DEMO")),
    keyFor(actor("synthetic-user-a", "DEVELOPMENT")),
  );
});

test("stub dashboard owner transition clears prior rows while same owner can reuse cache", () => {
  clearStubDashboardMemoryCache();
  const ownerA = actor("synthetic-user-a");
  const keyA = keyFor(ownerA);
  const data = { dashboard: { data: [{ family_head_name: "Synthetic Household A" }] } };
  activateStubDashboardMemoryOwner(ownerA);
  setStubDashboardCacheEntry(keyA, data);
  activateStubDashboardMemoryOwner(ownerA);
  assert.equal(getStubDashboardCacheEntry(keyA), data);

  activateStubDashboardMemoryOwner(actor("synthetic-user-b"));
  assert.equal(getStubDashboardCacheEntry(keyA), null);
});
