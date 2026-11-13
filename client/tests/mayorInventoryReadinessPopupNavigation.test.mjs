import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (file) =>
  fs.readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("all role readiness consumers use the shared durable acknowledgement", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");
  const readiness = await readSource("components/layout/OfflineDataReadiness.jsx");

  assert.match(readiness, /acknowledgeOfflineReady\(identity\)/);
  assert.match(readiness, /getOfflineReadyIdentity/);
  assert.match(readiness, /readyAcknowledged/);
  assert.match(layout, /<OfflineDataReadiness \{\.\.\.offlinePreparation\} \/>/);
  assert.doesNotMatch(layout, /MayorOfflineReadyDismissalContext|isMayorInventoryReadyAcknowledged/);
});

test("route remount and transient readiness states cannot reset acknowledgement", async () => {
  const readiness = await readSource("components/layout/OfflineDataReadiness.jsx");

  assert.doesNotMatch(readiness, /setDismissed|mayorDismissal/);
  assert.match(readiness, /if \(!readyNotice \|\| readyAcknowledged\)/);
  assert.match(readiness, /setReadyNotice\(false\); acknowledgeOfflineReady\(identity\)/);
});

test("Mayor inventory does not show the transient preparation notice", async () => {
  const readiness = await readSource("components/layout/OfflineDataReadiness.jsx");

  assert.match(readiness, /Offline Data Ready/);
  assert.match(readiness, /if \(!ready\) return null/);
});

test("MSWDO remains without offline readiness preparation UI", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");
  const preparation = await readSource("features/offline/useBarangayOfflinePreparation.js");

  assert.match(
    layout,
    /shouldShowBarangayOfflineReadiness \? \([\s\S]*?<OfflineDataReadiness/,
  );
  assert.match(layout, /enabled: isBarangayPortal/);
  assert.doesNotMatch(preparation, /ROLE_CODES\.MSWDO/);
});
