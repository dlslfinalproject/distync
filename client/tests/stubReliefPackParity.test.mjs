import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("stub dashboard normalization preserves the authoritative relief_pack_name", async () => {
  const source = await readSource("src/features/stubs/useMswdoStubDistribution.js");

  assert.match(source, /relief_pack_name:\s*stubRow\.relief_pack_name\s*\|\|\s*"--"/);
});

test("stub table renders the canonical relief_pack_name without detail fan-out", async () => {
  const [tableSource, pageSource] = await Promise.all([
    readSource("src/components/stubs/MswdoStubResultsTable.jsx"),
    readSource("src/pages/mswdo/StubDistributionPage.jsx"),
  ]);

  assert.match(tableSource, /row\?\.relief_pack_name/);
  assert.match(tableSource, /return "--"/);
  assert.match(pageSource, /const details = await fetchStubDetails\(row\.id\);/);
  assert.doesNotMatch(tableSource, /fetchStubDetails/);
});

test("offline stub snapshots retain the server canonical relief-pack name", async () => {
  const source = await readSource("src/features/stubs/stubCache.js");

  assert.match(source, /serverRow\.relief_pack_name/);
  assert.match(source, /relief_pack_name:\s*snapshot\.relief_pack_name/);
});
