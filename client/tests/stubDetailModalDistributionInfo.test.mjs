import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const stubDetailModalSourcePath = new URL(
  "../src/components/stubs/StubDetailModal.jsx",
  import.meta.url,
);
const inventoryDistributionDetailModalSourcePath = new URL(
  "../src/components/inventory-distribution/InventoryDistributionDetailModal.jsx",
  import.meta.url,
);
const barangayStubDistributionPageSourcePath = new URL(
  "../src/pages/barangay/StubDistributionPage.jsx",
  import.meta.url,
);
const mswdoStubDistributionPageSourcePath = new URL(
  "../src/pages/mswdo/StubDistributionPage.jsx",
  import.meta.url,
);
const verifyStubPageSourcePath = new URL(
  "../src/pages/VerifyStubPage.jsx",
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

test("inventory distribution detail modal shows authorized by beside receipt number in the QR stub section", async () => {
  const source = await fs.readFile(
    inventoryDistributionDetailModalSourcePath,
    "utf8",
  );

  assert.match(source, /const distributionTransaction = stubDetails\?\.distribution_transaction \|\| null;/);
  assert.match(source, /const authorizedByName =/);
  assert.match(source, /label="Receipt Number"/);
  assert.match(source, /label="Authorized By"/);
  assert.match(source, /distributionTransaction\?\.verified_by_name/);
  assert.match(source, /row\?\.authorized_by_name/);
});

test("stub detail modal keeps safe hyphen fallback for empty distribution transaction fields", async () => {
  const source = await fs.readFile(stubDetailModalSourcePath, "utf8");

  assert.match(source, /const formatInfoValue = \(value\) => \{/);
  assert.match(source, /if \(value === null \|\| value === undefined\) \{\s+return "-";/);
  assert.match(source, /return normalizedValue \? normalizedValue : "-";/);
});

test("stub detail modal renders disaster event title only without exposing the event code", async () => {
  const source = await fs.readFile(stubDetailModalSourcePath, "utf8");

  assert.match(
    source,
    /const getDisasterEventTitle = \(disasterEvent\) =>\s+formatInfoValue\(disasterEvent\?\.title\);/,
  );
  assert.match(source, /<p style=\{modalStyles\.label\}>Disaster Event<\/p>/);
  assert.match(source, /getDisasterEventTitle\(disasterEvent\)/);
  assert.doesNotMatch(source, /disasterEvent\.event_code,\s+disasterEvent\.title/);
  assert.doesNotMatch(source, /\.join\(" - "\) \|\| "-"/);
});

test("barangay and mswdo relief distribution household views share the corrected stub detail modal", async () => {
  const barangaySource = await fs.readFile(
    barangayStubDistributionPageSourcePath,
    "utf8",
  );
  const mswdoSource = await fs.readFile(mswdoStubDistributionPageSourcePath, "utf8");

  assert.match(
    barangaySource,
    /import StubDetailModal from "\.\.\/\.\.\/components\/stubs\/StubDetailModal";/,
  );
  assert.match(barangaySource, /<StubDetailModal\s+isOpen=\{isStubDetailModalOpen\}/);
  assert.match(barangaySource, /stubDetails=\{selectedStubDetails\}/);
  assert.match(barangaySource, /const details = await fetchStubDetails\(row\.id,/);

  assert.match(
    mswdoSource,
    /import StubDetailModal from "\.\.\/\.\.\/components\/stubs\/StubDetailModal";/,
  );
  assert.match(mswdoSource, /<StubDetailModal\s+isOpen=\{isStubDetailModalOpen\}/);
  assert.match(mswdoSource, /stubDetails=\{selectedStubDetails\}/);
  assert.match(mswdoSource, /const details = await fetchStubDetails\(row\.id\);/);
});

test("qr-supported scanned stub view also renders disaster event title only", async () => {
  const source = await fs.readFile(verifyStubPageSourcePath, "utf8");

  assert.match(
    source,
    /const getDisasterEventTitle = \(disasterEvent\) =>\s+String\(disasterEvent\?\.title \|\| ""\)\.trim\(\) \|\| "--";/,
  );
  assert.match(source, /getDisasterEventTitle\(stubDetails\.disaster_event\)/);
  assert.doesNotMatch(source, /stubDetails\.disaster_event\?\.event_code,\s+stubDetails\.disaster_event\?\.title/);
});
