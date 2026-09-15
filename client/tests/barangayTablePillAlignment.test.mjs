import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readSource = (...segments) =>
  fs.readFile(path.join(process.cwd(), "src", ...segments), "utf8");

test("Barangay table pill columns keep headers and records centered", async () => {
  const [masterlistTable, reliefTable, distributionHistory, syncPage, anomalyPage] =
    await Promise.all([
      readSource("components", "masterlist", "MasterlistTable.jsx"),
      readSource("components", "stubs", "StubResultsTable.jsx"),
      readSource("pages", "DistributionHistoryPage.jsx"),
      readSource("pages", "SyncManagementPage.jsx"),
      readSource("pages", "mswdo", "AnomalyTrackingPage.jsx"),
    ]);

  assert.match(masterlistTable, /pillHeaderCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(masterlistTable, /Household Size[\s\S]*?pillBodyCell/);

  assert.match(reliefTable, /pillHeaderCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(reliefTable, /Household Size[\s\S]*?pillHeaderCell/);
  assert.match(reliefTable, /Status[\s\S]*?pillHeaderCell/);
  assert.match(reliefTable, /getStatusChipStyles\(presentationStatus\)/);
  assert.match(reliefTable, /statusColumn,[\s\S]*?pillBodyCell/);

  assert.match(distributionHistory, /pillHeaderCell: \{[\s\S]*?textAlign: "center"/);
  assert.match(distributionHistory, /Status<\/th>/);
  assert.match(distributionHistory, /pillBodyCell[\s\S]*?getDisasterEventStatusStyles/);
  assert.match(distributionHistory, /Household Size[\s\S]*?pillBodyCell/);

  assert.match(syncPage, /syncStatusHeaderStyles = \{[\s\S]*?textAlign: "center"/);
  assert.match(syncPage, /syncStatusCellStyles = \{[\s\S]*?textAlign: "center"/);
  assert.match(syncPage, /<SyncStatusBadge/);

  assert.match(
    anomalyPage,
    /reviewStatus: \{[\s\S]*?textAlign: "center"[\s\S]*?\}/,
  );
  assert.match(anomalyPage, /reviewStatus[\s\S]*?<StatusPill row=\{row\}/);
});
