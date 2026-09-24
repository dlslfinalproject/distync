import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(clientRoot, "..");
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), "utf8");

test("online registration persists the same sync identity and payload before submitting", () => {
  const registration = read(
    "client",
    "src",
    "features",
    "household-registration",
    "householdRegistrationService.js",
  );
  const sync = read("client", "src", "offline", "syncService.js");
  const queue = read("client", "src", "offline", "syncQueue.js");

  assert.match(registration, /X-Client-Sync-ID/);
  assert.match(registration, /persistBeforeRequest:\s*true/);
  assert.match(sync, /if \(persistBeforeRequest && allowOffline\)[\s\S]*?persistOfflineMutation\(/);
  assert.match(sync, /if \(prePersisted\) \{[\s\S]*?await removeSyncEntry\(clientSyncId\)/);
  assert.match(queue, /await db\.syncQueue\.delete\(entryId\)/);
});

test("explicit family-head Storage failures stay visible and retain retryable local media", () => {
  const sync = read("client", "src", "offline", "syncService.js");
  assert.match(sync, /\(\?:FAMILY_HEAD\|CLAIM_PROOF\)_PHOTO_\(\?:STORAGE_UNAVAILABLE\|UPLOAD_FAILED\|RETRIEVAL_FAILED\)/);
  assert.match(sync, /status:\s*LOCAL_SYNC_STATUS\.FAILED,[\s\S]*?lastErrorCode:\s*error\.code/);
  assert.match(sync, /throw error;[\s\S]*?if \(!prePersisted\) \{/);
});

test("offline preparation downloads authorized signed photos without HTTP or service-worker caching", () => {
  const householdPreparation = read("client", "src", "offline", "offlinePreparation.js");
  const mswdoPreparation = read("client", "src", "features", "offline", "mswdoOfflinePreparation.js");
  const stubService = read("client", "src", "features", "stubs", "stubService.js");
  const serviceWorker = read("client", "vite.config.js");
  const stubCache = read("client", "src", "features", "stubs", "stubCache.js");

  assert.match(householdPreparation, /fetch\(photoUrl,\s*\{\s*cache:\s*"no-store"\s*\}\)/);
  assert.match(mswdoPreparation, /fetch\(photoUrl,\s*\{\s*cache:\s*"no-store"\s*\}\)/);
  assert.match(stubService, /family-head-photo[\s\S]*?cache:\s*"no-store"/);
  assert.match(serviceWorker, /distync-family-head-photos[\s\S]*?handler:\s*"NetworkOnly"/);
  assert.match(stubCache, /family_head_photo_data_url/);
  assert.doesNotMatch(stubCache, /family_head_photo_url:\s*serverRow|family_head_photo_url:\s*household/);
});

test("Mayor inventory distribution still resolves and displays the registered family-head photo", () => {
  const route = read("server", "src", "routes", "distributionTransaction.routes.js");
  const service = read("server", "src", "services", "distributionTransaction.service.js");
  const page = read("client", "src", "pages", "inventory", "InventoryDistributionPage.jsx");
  const modal = read(
    "client",
    "src",
    "components",
    "inventory-distribution",
    "InventoryDistributionDetailModal.jsx",
  );

  assert.match(route, /\/inventory-distribution\/:stubId[\s\S]*?ROLE_CODES\.MAYOR/);
  assert.match(service, /familyHeadPhotoStorage\.resolveFamilyHeadPhoto/);
  assert.match(page, /fetchInventoryDistributionDetail\(row\.stub_id\)/);
  assert.match(modal, /<img[\s\S]*?src=\{familyHeadPhotoUrl\}/);
});
