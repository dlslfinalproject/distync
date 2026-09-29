import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  activateMasterlistMemoryOwner,
  buildMasterlistRequestKey,
  clearMasterlistMemoryCache,
  getMasterlistCacheEntry,
  isMasterlistMemoryOwnerCurrent,
  selectMasterlistFallbackData,
  setMasterlistCacheEntry,
} from "../src/features/masterlist/masterlistMemoryCache.mjs";

const request = {
  disasterEventId: "event-y",
  barangayId: "barangay-x",
  recordStatus: "active",
  page: 1,
  pageSize: 25,
  search: "",
  sectorIds: [],
  sortOrder: "name",
};

const actor = (userId, accessMode = "DEMO", roleCode = "BARANGAY") => ({
  accessMode,
  userId,
  roleCode,
});

const requestKey = (actorContext) =>
  buildMasterlistRequestKey({ ...request, actorContext });

test("same authenticated owner and request context can reuse its own cache", () => {
  clearMasterlistMemoryCache();
  const owner = actor("synthetic-user-a");
  const key = requestKey(owner);
  const data = { rows: [{ family_head_name: "Synthetic Household A" }] };
  activateMasterlistMemoryOwner(owner);
  setMasterlistCacheEntry(key, { data, isAuthoritative: true });

  activateMasterlistMemoryOwner(owner);

  assert.equal(getMasterlistCacheEntry(key)?.data, data);
});

test("masterlist memory cache separates owners with identical operational context", () => {
  const userA = buildMasterlistRequestKey({
    ...request,
    actorContext: {
      accessMode: "DEMO",
      userId: "synthetic-user-a",
      roleCode: "BARANGAY",
    },
  });
  const userB = buildMasterlistRequestKey({
    ...request,
    actorContext: {
      accessMode: "DEMO",
      userId: "synthetic-user-b",
      roleCode: "BARANGAY",
    },
  });

  assert.notEqual(userA, userB);
});

test("masterlist memory cache separates access modes for the same user", () => {
  const development = requestKey(actor("synthetic-user-a", "DEVELOPMENT"));
  const demo = requestKey(actor("synthetic-user-a", "DEMO"));

  assert.notEqual(development, demo);
});

test("an owner transition clears prior rows and blocks them as request-error fallback", () => {
  clearMasterlistMemoryCache();
  const ownerA = actor("synthetic-user-a");
  const ownerB = actor("synthetic-user-b");
  const keyA = requestKey(ownerA);
  const keyB = requestKey(ownerB);
  const householdA = { rows: [{ family_head_name: "Synthetic Household A" }] };

  const ownerKeyA = activateMasterlistMemoryOwner(ownerA);
  setMasterlistCacheEntry(keyA, { data: householdA, isAuthoritative: true });
  activateMasterlistMemoryOwner(ownerB);

  assert.equal(getMasterlistCacheEntry(keyA), null);
  assert.equal(isMasterlistMemoryOwnerCurrent(ownerKeyA), false);
  assert.equal(
    selectMasterlistFallbackData({
      requestKey: keyB,
      lastSuccessfulData: householdA,
      lastSuccessfulRequestKey: keyA,
    }),
    null,
  );
});

test("the bounded LRU behavior remains intact for one owner", () => {
  clearMasterlistMemoryCache();
  const owner = actor("synthetic-user-a");
  activateMasterlistMemoryOwner(owner);

  for (let index = 0; index < 25; index += 1) {
    setMasterlistCacheEntry(`request-${index}`, { data: index });
  }

  assert.equal(getMasterlistCacheEntry("request-0"), null);
  assert.equal(getMasterlistCacheEntry("request-24")?.data, 24);
});

test("masterlist hook guards cache writes and fallback state after an owner transition", async () => {
  const hookSource = await fs.readFile(
    new URL("../src/features/masterlist/masterlistHooks.js", import.meta.url),
    "utf8",
  );

  assert.match(hookSource, /const actorContext = getSyncQueueActorContext\(\)/);
  assert.match(hookSource, /activateMasterlistMemoryOwner\(actorContext\)/);
  assert.match(hookSource, /isActiveRequest\(\)\s*\) return/);
  assert.match(hookSource, /selectMasterlistFallbackData\(/);
  assert.match(hookSource, /isMasterlistMemoryOwnerCurrent\(ownerKey\)/);
});
