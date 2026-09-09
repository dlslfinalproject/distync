import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("MSWDO preparation uses the existing preparation store and verifies required datasets", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /db\.offlinePreparation/);
  assert.match(source, /datasets: \{/);
  assert.match(source, /masterlist: \{ complete: true/);
  assert.match(source, /dashboard: \{ complete: true/);
  assert.match(source, /filters: \{ complete: true/);
  assert.match(source, /readBack/);
  assert.doesNotMatch(source, /version\(/);
});

test("MSWDO cache scope includes mode, user, role, and event", async () => {
  const source = await read("features/offline/mswdoOfflinePreparation.js");
  assert.match(source, /\[mode, userId, ROLE_CODES\.MSWDO, eventId/);
  assert.match(source, /owner\.roleCode === ROLE_CODES\.MSWDO/);
});

test("MSWDO offline navigation keeps cached pages and mutes unsupported pages", async () => {
  const source = await read("features/offline/mswdoOfflineAccess.js");
  assert.match(source, /consolidated-masterlist/);
  assert.match(source, /analytics/);
  assert.match(source, /startsWith\("\/mswdo\/"\)/);
  assert.match(source, /Connect online to access this page/);
});

test("MSWDO pages preserve valid cache on failed online reads and refresh on reconnect", async () => {
  const masterlist = await read("features/mswdo-masterlist/useMswdoMasterlist.js");
  const analytics = await read("features/mswdo-analytics/useMswdoAnalytics.js");
  assert.match(masterlist, /readMswdoOfflineSnapshot/);
  assert.match(masterlist, /setMasterlistPayload\(cached\.datasets\.masterlist/);
  assert.match(masterlist, /addEventListener\?\.\("online"/);
  assert.match(analytics, /readMswdoOfflineSnapshot/);
  assert.match(analytics, /setOperationalPayload\(cached\.datasets\.dashboard/);
  assert.match(analytics, /addEventListener\?\.\("online"/);
});

test("MSWDO event selection is durably restorable and carries event context", async () => {
  const source = await read("features/disaster-events/operationalDisasterEventSelection.js");
  assert.match(source, /ROLE_CODES\.BARANGAY \|\| roleCode === ROLE_CODES\.MSWDO/);
  assert.match(source, /event: eventSnapshot/);
});

