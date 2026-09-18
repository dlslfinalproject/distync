import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("MSWDO stub distribution wires the hook filter loading state into page reconciliation", async () => {
  const pageSource = await readSource(
    "../src/pages/mswdo/StubDistributionPage.jsx",
  );
  const hookSource = await readSource(
    "../src/features/stubs/useMswdoStubDistribution.js",
  );

  assert.match(
    pageSource,
    /displayedRows,\s*pagination,\s*isLoadingFilters,\s*summaryCards,/s,
  );
  assert.match(
    pageSource,
    /if \(isLoadingFilters \|\| !isEventSelectionResolved\) \{\s*return;\s*\}/,
  );
  assert.match(hookSource, /const \[isLoadingFilters, setIsLoadingFilters\]/);
  assert.match(hookSource, /isLoadingFilters,\s*isInitialLoadingFilters:/s);
});

