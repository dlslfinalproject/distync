import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("both operational role consumers use the shared readiness presentation", async () => {
  const layout = await read("components/layout/BarangayLayout.jsx");
  const mswdoOfflineAccess = await read("features/offline/mswdoOfflineAccess.js");
  assert.match(
    layout,
    /shouldShowBarangayOfflineReadiness \? \([\s\S]*?<OfflineDataReadiness \{\.\.\.offlinePreparation\} \/>/,
  );
  assert.match(layout, /MSWDO_OFFLINE_SUPPORTED_ROUTES/);
  assert.match(
    layout,
    /shouldShowMswdoOfflineReadiness =\s*isMswdoPortal && MSWDO_OFFLINE_SUPPORTED_ROUTES\.has\(location\.pathname\)/,
  );
  assert.match(
    layout,
    /shouldShowMswdoOfflineReadiness \? \([\s\S]*?<OfflineDataReadiness \{\.\.\.mswdoOfflinePreparation\} variant="mswdo" \/>/,
  );
  assert.doesNotMatch(
    layout,
    /isMswdoPortal \? <OfflineDataReadiness \{\.\.\.mswdoOfflinePreparation\} variant="mswdo" \/>/,
  );
  assert.match(mswdoOfflineAccess, /"\/mswdo\/consolidated-masterlist"/);
  assert.match(mswdoOfflineAccess, /"\/mswdo\/stub-distribution"/);
  assert.doesNotMatch(mswdoOfflineAccess, /"\/mswdo\/distribution-history"/);
  assert.doesNotMatch(mswdoOfflineAccess, /"\/mswdo\/disaster-events"/);
});

test("hidden readiness states have no notification copy while internal statuses remain", async () => {
  const popup = await read("components/layout/OfflineDataReadiness.jsx");
  const preparation = await read("offline/offlinePreparation.js");
  const mswdoPreparation = await read("features/offline/mswdoOfflinePreparation.js");
  for (const status of ["PREPARING", "NOT_READY", "NEEDS_REFRESH", "READY"]) {
    assert.match(preparation, new RegExp(status));
  }
  assert.match(mswdoPreparation, /status: "PREPARING"/);
  assert.match(popup, /if \(!ready\) return null/);
  assert.doesNotMatch(popup, /Offline Data Not Ready/);
  assert.doesNotMatch(popup, /Offline Data Needs Refresh/);
});
