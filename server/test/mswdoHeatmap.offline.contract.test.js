const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const offlinePreparationSource = fs.readFileSync(
  path.join(repositoryRoot, "client/src/features/offline/mswdoOfflinePreparation.js"),
  "utf8",
);
const dashboardServiceSource = fs.readFileSync(
  path.join(repositoryRoot, "client/src/features/mswdo-masterlist/mswdoMasterlistService.js"),
  "utf8",
);

test("MSWDO offline snapshot retains the complete dashboard response payload", () => {
  assert.match(
    dashboardServiceSource,
    /api\/v1\/masterlist\/mswdo-dashboard/,
  );
  assert.match(
    offlinePreparationSource,
    /fetchConsolidatedMasterlistDashboard\(\{ disasterEventId: eventId \}\)/,
  );
  assert.match(
    offlinePreparationSource,
    /dashboard:\s*\{ complete:\s*true, valid:\s*true, payload:\s*dashboard \}/,
  );
  assert.doesNotMatch(offlinePreparationSource, /dashboard\.barangay_heatmap/);
});
