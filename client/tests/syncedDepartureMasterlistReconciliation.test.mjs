import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const readSource = (...segments) =>
  fs.readFile(path.join(testDirectory, "..", ...segments), "utf8");

test("authoritative Masterlist data is not merged with stale durable rows", async () => {
  const source = await readSource(
    "src",
    "features",
    "masterlist",
    "useBarangayMasterlistSync.js",
  );

  assert.match(source, /!isAuthoritative && Array\.isArray\(cachedMasterlistRows\)/);
  assert.match(source, /isAuthoritative = false/);
});

test("successful household departures emit one scoped reconciliation batch", async () => {
  const source = await readSource("src", "offline", "syncService.js");

  assert.match(source, /syncedEntries\.push\(entry\)/);
  assert.match(source, /type: "masterlist-reconciliation"/);
  assert.match(source, /entry\.actionKey === "HOUSEHOLD_DEPART"/);
  assert.match(source, /reconcileCachedMasterlistDeparture/);
});

test("cache reconciliation preserves scope and projects the occurrence as archived", async () => {
  const source = await readSource("src", "offline", "masterlistCache.js");

  assert.match(source, /disasterEventId/);
  assert.match(source, /barangayId/);
  assert.match(source, /householdId/);
  assert.match(source, /is_operationally_active: false/);
  assert.match(source, /db\.offlineMasterlistCache\.put/);
});
