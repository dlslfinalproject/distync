import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("stub verification keeps the desktop composition and exposes scoped layout hooks", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readSource("src/pages/VerifyStubPage.jsx"),
    readSource("src/pages/verifyStubPage.css"),
  ]);

  assert.match(pageSource, /className="verify-stub-page"/);
  assert.match(pageSource, /className="verify-stub-page__verification-layout"/);
  assert.match(pageSource, /className="verify-stub-page__details-list"/);
  assert.match(pageSource, /className="verify-stub-page__action-link"/);

  assert.match(
    cssSource,
    /\.verify-stub-page__verification-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(220px, 280px\) minmax\(0, 1fr\);/,
  );
  assert.match(
    cssSource,
    /\.verify-stub-page__detail-row\s*\{[\s\S]*?grid-template-columns:\s*180px minmax\(0, 1fr\);/,
  );
});

test("stub verification stacks mobile content and keeps values and actions readable", async () => {
  const cssSource = (await readSource("src/pages/verifyStubPage.css")).replace(
    /\r\n/g,
    "\n",
  );
  const mobileCss = cssSource.slice(
    cssSource.indexOf("@media (max-width: 768px)"),
  );

  assert.match(
    mobileCss,
    /\.verify-stub-page__verification-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    mobileCss,
    /\.verify-stub-page__detail-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    mobileCss,
    /\.verify-stub-page__action-link\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-content:\s*center;/,
  );
  assert.match(cssSource, /min-width:\s*0;/);
  assert.match(cssSource, /max-width:\s*100%;/);
  assert.match(
    cssSource,
    /\.verify-stub-page__detail-value\s*\{[\s\S]*?overflow-wrap:\s*break-word;[\s\S]*?word-break:\s*normal;/,
  );
  assert.doesNotMatch(cssSource, /word-break:\s*break-all/);
});

test("stub verification retains all detail fields and existing next-step actions", async () => {
  const source = await readSource("src/pages/VerifyStubPage.jsx");

  for (const label of [
    "Stub Number",
    "Claim Status",
    "Family Head Name",
    "Barangay",
    "Disaster Event",
    "Household Size",
    "Relief Pack",
    "Sectors",
  ]) {
    assert.match(source, new RegExp(`>\\s*${label}\\s*<`));
  }

  assert.match(source, /Proceed to Distribution Validation/);
  assert.match(source, /Open Workspace/);
  assert.match(source, /to=\{proceedLink\}/);
  assert.match(source, /to=\{getDefaultWorkspaceLink\(currentRole\)\}/);
});
