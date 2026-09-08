import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.jsx");
const accessPath = path.join(process.cwd(), "src", "features", "offline", "barangayOfflineAccess.js");
const read = (filePath) => fs.readFile(filePath, "utf8");

test("Barangay offline capability map keeps supported and online-only routes distinct", async () => {
  const source = await read(accessPath);
  const access = await import(pathToFileURL(accessPath));
  assert.equal(access.isBarangayOfflineRouteAvailable("/barangay/masterlist"), true);
  assert.equal(
    access.isBarangayOfflineRouteAvailable("/barangay/stub-distribution"),
    true,
  );
  assert.equal(access.isBarangayOfflineRouteAvailable("/barangay/sync"), true);
  assert.equal(
    access.isBarangayOfflineBlockedRoute("/barangay/distribution-history"),
    true,
  );
  assert.equal(access.isBarangayOfflineBlockedRoute("/barangay/anomalies"), true);
  assert.match(source, /isBarangayOfflineBlockedRoute/);
});

test("Barangay sidebar preserves reactive blocking and accessible unavailable state", async () => {
  const source = await read(sidebarPath);
  assert.match(source, /isBarangayOfflineBlockedRoute\(item\.to\)/);
  assert.match(source, /isOffline = false/);
  assert.match(source, /isBarangayOfflineLocked/);
  assert.match(source, /onClick=\{handleNavigationClick\}/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /aria-disabled=\{isMayorOfflineLocked \? "true" : undefined\}/);
  assert.match(source, /tabIndex=\{isMayorOfflineLocked \? -1 : undefined\}/);
  assert.match(source, /Internet connection required/);
  assert.match(source, /opacity: isBarangayOfflineLocked[\s\S]*?0\.55/);
  assert.match(source, /cursor: isMayorOfflineLocked \? "not-allowed"/);
  assert.doesNotMatch(source, /CloudOff|WifiOff/);
});

test("Barangay supported links and newer role navigation remain present", async () => {
  const source = await read(sidebarPath);
  assert.match(source, /\/barangay\/masterlist/);
  assert.match(source, /\/barangay\/stub-distribution/);
  assert.match(source, /\/barangay\/sync/);
  assert.match(source, /isMayorOfflineBlockedRoute/);
  assert.match(source, /MAYOR_OFFLINE_ACCESS_MESSAGE/);
  assert.match(source, /\[ROLE_CODES\.MSWDO\]:/);
  assert.match(source, /\/mswdo\/anomalies/);
  assert.match(source, /\[ROLE_CODES\.MAYOR\]:/);
  assert.match(source, /\/inventory\/anomalies/);
});
