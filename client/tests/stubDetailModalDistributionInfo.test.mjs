import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const stubDetailModalSourcePath = new URL(
  "../src/components/stubs/StubDetailModal.jsx",
  import.meta.url,
);

test("stub detail modal shows receipt number and authorized by from the selected stub distribution transaction", async () => {
  const source = await fs.readFile(stubDetailModalSourcePath, "utf8");

  assert.match(source, /const distributionTransaction = stubDetails\?\.distribution_transaction \|\| null;/);
  assert.match(source, /Receipt Number/);
  assert.match(source, /Authorized By/);
  assert.match(source, /formatInfoValue\(distributionTransaction\?\.receipt_no\)/);
  assert.match(source, /formatInfoValue\(distributionTransaction\?\.verified_by_name\)/);
  assert.doesNotMatch(source, /formatInfoValue\(distributionTransaction\?\.claimed_by_name\)/);
});

test("stub detail modal keeps safe hyphen fallback for empty distribution transaction fields", async () => {
  const source = await fs.readFile(stubDetailModalSourcePath, "utf8");

  assert.match(source, /const formatInfoValue = \(value\) => \{/);
  assert.match(source, /if \(value === null \|\| value === undefined\) \{\s+return "-";/);
  assert.match(source, /return normalizedValue \? normalizedValue : "-";/);
});
