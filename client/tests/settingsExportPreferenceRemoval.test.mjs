import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const helpersSourcePath =
  new URL("../src/pages/settings/settingsHelpers.js", import.meta.url);
const serviceSourcePath =
  new URL("../src/features/settings/settingsService.js", import.meta.url);

test("settings helpers no longer define preferredExportFormat defaults", async () => {
  const source = await fs.readFile(helpersSourcePath, "utf8");

  assert.doesNotMatch(source, /preferredExportFormat\s*:\s*["']/);
  assert.match(source, /_removedPreferredExportFormat/);
});

test("settings service strips stale preferredExportFormat values before caching", async () => {
  const source = await fs.readFile(serviceSourcePath, "utf8");

  assert.doesNotMatch(source, /preferredExportFormat\s*:\s*["']/);
  assert.match(source, /_removedPreferredExportFormat/);
});
