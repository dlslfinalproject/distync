import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);

const readPageSource = () => fs.readFile(pageSourcePath, "utf8");

test("BRG-ANOM-P01 Barangay table presents the required review context in order", async () => {
  const source = await readPageSource();
  const tableStart = source.indexOf("<thead>");
  const tableEnd = source.indexOf("</thead>", tableStart);
  const barangayHeaderBlock = source.slice(tableStart, tableEnd);

  assert.match(
    barangayHeaderBlock,
    /Anomaly Type[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/,
  );
  assert.match(source, /formatEventLabel\(row\)/);
  assert.doesNotMatch(barangayHeaderBlock, />Anomaly<\/th>/);
});

test("BRG-ANOM-P02 event rendering uses the stored title and an explicit missing-value fallback", async () => {
  const source = await readPageSource();
  const formatterStart = source.indexOf("const formatEventLabel");
  const formatterEnd = source.indexOf("const formatBarangayLabel", formatterStart);
  const formatter = source.slice(formatterStart, formatterEnd);

  assert.match(formatter, /row\?\.disaster_event_title/);
  assert.match(formatter, /row\?\.disaster_event\?\.title/);
  assert.match(formatter, /row\?\.disasterEvent\?\.title/);
  assert.match(source, /const formatNullableValue = \(value, fallback = "Not available"\)/);
  assert.doesNotMatch(formatter, /row\?\.title/);
  assert.doesNotMatch(formatter, /disaster_event_id/);
});

test("BRG-ANOM-P03 anomaly type cells do not use decorative icons and lifecycle actions are accessible", async () => {
  const source = await readPageSource();

  assert.doesNotMatch(source, /\bFiAlertTriangle\b/);
  assert.match(source, /\bFiEye\b/);
  assert.match(source, /\bviewButtonStyles\b/);
  assert.match(source, /<span style=\{\{ fontWeight: 700 \}\}>\s*\{formatAnomalyType\(row\.anomaly_type, presentationScope\)\}/);
  assert.match(source, />\s*Review\s*<\/button>/);
  assert.match(source, /aria-label="Review anomaly"/);
  assert.match(source, /aria-label="View anomaly details"/);
  assert.match(source, /const isManualReviewableAnomaly = \(row\) => row\?\.manual_review_allowed === true/);
});

test("BRG-ANOM-P04 sync and automatically handled rows do not gain duplicate recovery actions", async () => {
  const source = await readPageSource();

  assert.match(source, /return "Sync Center"/);
  assert.match(source, /return "No review needed"/);
  assert.match(source, /getAnomalyRowActionLabel\(row\)/);
  assert.doesNotMatch(source, /Retry Sync|Force Sync|Manual Sync/);
  assert.doesNotMatch(source, /onRetry|onResolve|resolveSync/);
});

test("BRG-ANOM-P05 responsive table and modal workflow contracts remain intact", async () => {
  const source = await readPageSource();
  const modalStart = source.indexOf("const AnomalyDetailModal");
  const modalEnd = source.indexOf("const AnomalyTrackingPage", modalStart);
  const modalSource = source.slice(modalStart, modalEnd);

  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.match(source, /const barangayAnomalyTableMinWidth = "1040px"/);
  assert.doesNotMatch(source, /tableLayout: "fixed"/);
  assert.match(source, /<TablePagination[\s\S]*ariaLabel="Anomaly tracking pagination"/);
  assert.match(
    modalSource,
    /title=\{\s*\(isBarangayScope \|\| isMayorScope\) && !hasSavedReview\s*\? "Review Anomaly"\s*:\s*"Anomaly Details"\s*\}/,
  );
  assert.match(modalSource, /<div style=\{labelStyles\}>Anomaly Type<\/div>/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Context<\/div>/);
  assert.match(modalSource, /<div style=\{labelStyles\}>Why Flagged<\/div>/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Recommended Action<\/div>/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Review Result<\/div>/);
  assert.doesNotMatch(modalSource, /Responsible Office/);
  assert.match(modalSource, /<DetailField label="Recommendation">/);
  assert.match(modalSource, /<DetailField label="Note" fullWidth>/);
  assert.match(modalSource, /<label htmlFor="anomaly-review-note" style=\{labelStyles\}>\s*Note \*/);
  assert.match(modalSource, /Edit Review/);
  assert.match(modalSource, /const shouldShowReviewForm =\s*canRecordReview && \(!hasSavedReview \|\| \(isBarangayScope && isEditingReview\)\)/);
  assert.match(modalSource, /disabled=\{isSaveDisabled\}/);
});
