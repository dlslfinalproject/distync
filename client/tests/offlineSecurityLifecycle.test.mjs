import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("logout exposes queue-aware Sync, Cancel, and confirmed Discard actions", async () => {
  const source = await readSource("../src/components/layout/SidebarAccountMenu.jsx");

  assert.match(source, /getActorLogoutDecisionEntriesFromStore\(actor\)/);
  assert.match(source, /flushPendingSyncEntries\(\{ source: "logout" \}\)/);
  assert.match(source, /Sync and Logout/);
  assert.match(source, />\s*Cancel\s*</);
  assert.match(source, /Discard Offline Data and Logout/);
  assert.match(source, /setIsDiscardDialogOpen\(true\)/);
  assert.match(source, /user-confirmed-discard/);
  assert.match(source, /Nothing unresolved was deleted/);
  assert.match(source, /hasUnresolvedConflict = unresolvedEntries\.some/);
  assert.match(source, /hasUnresolvedFailure = unresolvedEntries\.some/);
  assert.match(source, /!logoutCheckFailed && isOnline \?/);
});

test("auth storage changes invalidate in-memory data in other tabs", async () => {
  const [authSource, masterlistSource, stubSource] = await Promise.all([
    readSource("../src/context/AuthContext.jsx"),
    readSource("../src/features/masterlist/masterlistMemoryCache.mjs"),
    readSource("../src/features/stubs/stubDashboardMemoryCache.mjs"),
  ]);

  assert.match(authSource, /window\.addEventListener\("storage", handleStorageChange\)/);
  assert.match(authSource, /getAuthSessionStorageKey\(accessMode\)/);
  assert.match(authSource, /clearSensitiveOfflineMemoryCaches\(\)/);
  assert.match(authSource, /clearMasterlistMemoryCache\(\)/);
  assert.match(authSource, /clearStubDashboardMemoryCache\(\)/);
  assert.match(masterlistSource, /masterlistDataCache\.clear\(\)/);
  assert.match(stubSource, /stubDashboardDataCache\.clear\(\)/);
});

test("protected beneficiary responses and signed photos remain outside Workbox runtime caches", async () => {
  const [viteSource, apiSource, offlinePhotoSource, mswdoPhotoSource] =
    await Promise.all([
      readSource("../vite.config.js"),
      readSource("../src/utils/apiClient.js"),
      readSource("../src/offline/offlinePreparation.js"),
      readSource("../src/features/offline/mswdoOfflinePreparation.js"),
    ]);

  assert.match(viteSource, /url\.pathname\.startsWith\("\/api\/"\)[\s\S]*handler: "NetworkOnly"/);
  assert.match(viteSource, /distync-family-head-photos[\s\S]*handler: "NetworkOnly"/);
  assert.match(viteSource, /distync-claim-proof-photos[\s\S]*handler: "NetworkOnly"/);
  assert.match(apiSource, /new Request\(request, \{ cache: "no-store" \}\)/);
  assert.match(offlinePhotoSource, /fetch\(photoUrl, \{ cache: "no-store" \}\)/);
  assert.match(mswdoPhotoSource, /fetch\(photoUrl, \{ cache: "no-store" \}\)/);
});
