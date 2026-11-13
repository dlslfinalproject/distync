import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const profileSectionSourcePath = new URL(
  "../src/pages/settings/components/ProfileSection.jsx",
  import.meta.url,
);

test("account information grid uses shrink-safe responsive columns", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(
    source,
    /gridTemplateColumns:\s*"repeat\(auto-fit, minmax\(min\(100%, 320px\), 1fr\)\)"/,
  );
  assert.match(source, /const accountInformationGridStyles = \{/);
  assert.match(source, /minWidth:\s*0/);
});

test("account information values and helper text allow wrapping", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /overflowWrap:\s*"anywhere"/);
  assert.match(source, /wordBreak:\s*"break-word"/);
  assert.match(source, /whiteSpace:\s*"normal"/);
  assert.doesNotMatch(source, /whiteSpace:\s*"nowrap"/);
});

test("read-only badge and cards avoid fixed overlap assumptions", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /const systemTagStyles = \{/);
  assert.match(source, /flexWrap:\s*"wrap"/);
  assert.match(source, /maxWidth:\s*"100%"/);
  assert.match(source, /const readOnlyContentStackStyles = \{/);
});
