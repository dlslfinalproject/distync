import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const systemInformationSectionSourcePath = new URL(
  "../src/pages/settings/components/SystemInformationSection.jsx",
  import.meta.url,
);
const barangaySettingsViewSourcePath = new URL(
  "../src/pages/settings/views/BarangaySettingsView.jsx",
  import.meta.url,
);

test("system information section source includes the required groups and refresh control", async () => {
  const source = await fs.readFile(systemInformationSectionSourcePath, "utf8");

  assert.match(source, /Application Information/);
  assert.match(source, /Offline Capability/);
  assert.match(source, /About DISTYNC/);
  assert.match(source, /Refresh system information/);
  assert.doesNotMatch(source, /Available for supported features/);
});

test("barangay settings view uses the canonical SystemInformationSection component only", async () => {
  const source = await fs.readFile(barangaySettingsViewSourcePath, "utf8");

  assert.match(source, /SystemInformationSection/);
  assert.doesNotMatch(source, /SyncPreferencesSection/);
  assert.match(source, /systemInformationSectionProps/);
});
