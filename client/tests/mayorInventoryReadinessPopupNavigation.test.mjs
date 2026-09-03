import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (file) =>
  fs.readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Mayor READY popup acknowledgement is in-memory at the shared layout scope", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");
  const readiness = await readSource("components/layout/OfflineDataReadiness.jsx");

  assert.match(readiness, /MayorOfflineReadyDismissalContext/);
  assert.match(readiness, /mayorDismissal\?\.acknowledge\(\)/);
  assert.match(readiness, /readyAcknowledged/);
  assert.match(layout, /MayorOfflineReadyDismissalContext\.Provider/);
  assert.match(layout, /isMayorInventoryReadyAcknowledged/);
  assert.doesNotMatch(layout, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(readiness, /localStorage|sessionStorage|indexedDB/i);
});

test("route remount cannot reset an acknowledged READY popup, while non-READY resets it", async () => {
  const readiness = await readSource("components/layout/OfflineDataReadiness.jsx");

  assert.match(readiness, /readiness !== OFFLINE_PREPARATION_STATUS\.READY\) mayorDismissal\?\.reset\(\)/);
  assert.match(readiness, /ready && \(!readyNotice \|\| readyAcknowledged\)/);
  assert.match(readiness, /setReadyNotice\(false\); setDismissed\(true\); mayorDismissal\?\.acknowledge\(\)/);
});

test("MSWDO remains without offline readiness preparation UI", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");
  const preparation = await readSource("features/offline/useBarangayOfflinePreparation.js");

  assert.match(layout, /isBarangayPortal \? <OfflineDataReadiness/);
  assert.match(layout, /enabled: isBarangayPortal/);
  assert.doesNotMatch(preparation, /ROLE_CODES\.MSWDO/);
});
