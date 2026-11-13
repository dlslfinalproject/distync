import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");

test("stub printing is disabled and guarded while offline in both distribution dashboards", async () => {
  const [mswdo, barangay, modal] = await Promise.all([
    readSource("pages/mswdo/StubDistributionPage.jsx"),
    readSource("pages/barangay/StubDistributionPage.jsx"),
    readSource("components/stubs/StubPrintSheetModal.jsx"),
  ]);

  for (const source of [mswdo, barangay]) {
    assert.match(source, /if \(!isOnline\) \{\s+return;/);
    assert.match(source, /disabled=\{!isOnline \|\|/);
    assert.match(source, /isOnline=\{isOnline\}/);
  }

  assert.match(modal, /isOnline = true/);
  assert.match(modal, /if \(!isOnline\) \{/);
  assert.match(modal, /disabled=\{!isOnline\}/);
});

test("standalone stub print page does not print while offline", async () => {
  const source = await readSource("pages/mswdo/PrintStubsPage.jsx");

  assert.match(source, /navigator\.onLine !== false/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.match(source, /window\.addEventListener\("offline"/);
  assert.match(source, /if \(!isOnline\) \{\s+return;/);
  assert.match(source, /disabled=\{!isOnline\}/);
});
