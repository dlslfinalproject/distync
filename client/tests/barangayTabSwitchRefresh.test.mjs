import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("Barangay portal does not revalidate when returning from another tab", async () => {
  const layoutSource = await readSource(
    "../src/components/layout/BarangayLayout.jsx",
  );

  assert.match(
    layoutSource,
    /if \(!isBarangayPortal\) \{[\s\S]*window\.addEventListener\("focus", handleFocus\);[\s\S]*document\.addEventListener\("visibilitychange", handleVisibilityChange\);/,
  );
  assert.match(
    layoutSource,
    /if \(!isBarangayPortal\) \{[\s\S]*window\.removeEventListener\("focus", handleFocus\);[\s\S]*document\.removeEventListener\("visibilitychange", handleVisibilityChange\);/,
  );
  assert.match(layoutSource, /\}, \[isBarangayPortal, isDonorPortal\]\);/);
});

test("Barangay pages do not attach independent tab-return refresh listeners", async () => {
  const masterlistSource = await readSource(
    "../src/features/masterlist/useBarangayMasterlistSync.js",
  );
  const syncSource = await readSource("../src/pages/SyncManagementPage.jsx");
  const settingsSource = await readSource(
    "../src/pages/settings/useSystemInformation.js",
  );

  assert.doesNotMatch(masterlistSource, /addEventListener\("focus"/);
  assert.doesNotMatch(masterlistSource, /addEventListener\("visibilitychange"/);
  assert.match(
    syncSource,
    /if \(!isBarangayPortal\) \{[\s\S]*window\.addEventListener\("focus", refreshSyncHistory\);[\s\S]*document\.addEventListener\("visibilitychange", handleVisibilityRefresh\);/,
  );
  assert.match(
    settingsSource,
    /const shouldRefreshOnTabReturn = roleCode !== ROLE_CODES\.BARANGAY;/,
  );
  assert.match(
    settingsSource,
    /if \(shouldRefreshOnTabReturn\) \{[\s\S]*window\.addEventListener\("focus", handleWindowFocus\);[\s\S]*document\.addEventListener\("visibilitychange", handleVisibilityChange\);/,
  );
});
