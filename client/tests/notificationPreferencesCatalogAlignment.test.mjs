import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const settingsHelpersSourcePath = new URL(
  "../src/pages/settings/settingsHelpers.js",
  import.meta.url,
);

test("notification helper source reflects the approved visible notification labels", async () => {
  const source = await fs.readFile(settingsHelpersSourcePath, "utf8");

  assert.match(source, /"Disaster Event Updates":/);
  assert.match(source, /"New Evacuee Registration":/);
  assert.match(source, /"Evacuee Attendance Updates":/);
  assert.match(source, /"Household Verification Updates":/);
  assert.match(source, /"Distribution Completed":/);
  assert.match(source, /"Critical Inventory Shortage":/);
  assert.match(source, /"Donation Received":/);
  assert.match(source, /"Operational Anomaly Alerts":/);
  assert.match(source, /"Sync Failure":/);
  assert.match(source, /"Evacuation Summary Reports":/);
});
