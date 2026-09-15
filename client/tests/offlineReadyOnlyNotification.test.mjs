import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("both operational role consumers use the shared readiness presentation", async () => {
  const layout = await read("components/layout/BarangayLayout.jsx");
  assert.match(
    layout,
    /shouldShowBarangayOfflineReadiness \? \([\s\S]*?<OfflineDataReadiness \{\.\.\.offlinePreparation\} \/>/,
  );
  assert.match(layout, /isMswdoPortal \? <OfflineDataReadiness \{\.\.\.mswdoOfflinePreparation\} variant="mswdo" \/>/);
});

test("hidden readiness states have no notification copy while internal statuses remain", async () => {
  const popup = await read("components/layout/OfflineDataReadiness.jsx");
  const preparation = await read("offline/offlinePreparation.js");
  const mswdoPreparation = await read("features/offline/mswdoOfflinePreparation.js");
  for (const status of ["PREPARING", "NOT_READY", "NEEDS_REFRESH", "READY"]) {
    assert.match(preparation, new RegExp(status));
  }
  assert.match(mswdoPreparation, /status: "PREPARING"/);
  assert.match(popup, /if \(isBarangayOrMswdo && !ready\) return null/);
  assert.doesNotMatch(popup, /Offline Data Not Ready/);
  assert.doesNotMatch(popup, /Offline Data Needs Refresh/);
});
