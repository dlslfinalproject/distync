import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (file) =>
  fs.readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Barangay offline notice is shared and reactive", async () => {
  const notice = await readSource("components/layout/BarangayOfflineModeNotice.jsx");
  const layout = await readSource("components/layout/BarangayLayout.jsx");

  assert.match(notice, /Offline Mode Active/);
  assert.match(notice, /supported offline actions/);
  assert.match(notice, /addEventListener\("offline"/);
  assert.match(notice, /addEventListener\("online"/);
  assert.match(notice, /return null/);
  assert.match(layout, /<BarangayOfflineModeNotice \/>/);
  assert.match(layout, /isBarangayPortal \? <BarangayOfflineModeNotice/);
});

test("offline readiness remains a separate Barangay layout concern", async () => {
  const layout = await readSource("components/layout/BarangayLayout.jsx");

  assert.match(layout, /<BarangayOfflineModeNotice \/>/);
  assert.match(layout, /<OfflineDataReadiness \{\.\.\.offlinePreparation\} \/>/);
});

test("Mayor Inventory reference still owns its existing scoped banner", async () => {
  const inventory = await readSource("pages/inventory/InventoryItemsPage.jsx");
  const banner = await readSource("components/layout/SyncStatusBanner.jsx");

  assert.match(inventory, /<SyncStatusBanner scope="mayor-inventory" \/>/);
  assert.match(banner, /Offline Mode Active/);
});

test("Masterlist no longer emits the redundant page-level offline messages", async () => {
  const hook = await readSource("features/masterlist/masterlistHooks.js");
  const privacy = await readSource("features/household-registration/privacyNotice.mjs");
  const modal = await readSource("components/household-registration/DataPrivacyConsentModal.jsx");

  assert.doesNotMatch(hook, /Offline mode: showing the last saved Masterlist/);
  assert.match(privacy, /HOUSEHOLD_PRIVACY_OFFLINE_MESSAGE/);
  assert.match(modal, /Data Privacy|acknowledgment/i);
});
