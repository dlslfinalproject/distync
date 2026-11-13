import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const profileSectionSourcePath = new URL(
  "../src/pages/settings/components/ProfileSection.jsx",
  import.meta.url,
);

test("profile information layout stacks before editable fields become unusably narrow", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /const profileInformationGridStyles = \{/);
  assert.match(
    source,
    /gridTemplateColumns:\s*"repeat\(auto-fit, minmax\(min\(100%, 300px\), 1fr\)\)"/,
  );
  assert.doesNotMatch(
    source,
    /gridTemplateColumns:\s*"minmax\(220px, 260px\) minmax\(0, 1fr\)"/,
  );
});

test("profile settings card keeps mobile padding fluid", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /padding:\s*"clamp\(20px, 4vw, 32px\)"/);
  assert.doesNotMatch(source, /padding:\s*"32px"/);
});
