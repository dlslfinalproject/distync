import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);

const readPageSource = () => fs.readFile(pageSourcePath, "utf8");

test("BRG-ANOM-L01 Barangay status labels describe pending and resolved workflow states", async () => {
  const source = await readPageSource();

  assert.match(
    source,
    /if \(scope === "barangay"\) \{[\s\S]*row\?\.review_status \? "Resolved" : "Pending Review"/,
  );
  assert.match(source, /if \(row\?\.review_status\) \{\s*return "resolved";/);
  assert.match(source, /\{ value: "needs_review", label: "Pending Review" \}/);
  assert.match(source, /\{ value: "reviewed", label: "Resolved" \}/);
  assert.match(source, />Review Status<\/th>/);
});

test("BRG-ANOM-L02 pending and resolved Barangay anomalies expose different actions", async () => {
  const source = await readPageSource();

  assert.match(
    source,
    /isManualReviewableAnomaly\(row\) && row\.review_status \? \(/,
  );
  assert.match(source, /aria-label="View anomaly details"/);
  assert.match(source, /<FiEye size=\{18\} aria-hidden="true" \/>/);
  assert.match(source, /: isManualReviewableAnomaly\(row\) \? \(/);
  assert.match(source, /aria-label="Review anomaly"/);
  assert.doesNotMatch(source, /Review anomaly details for/);
});

test("BRG-ANOM-L03 resolved Barangay details are read-only while pending reviews remain editable", async () => {
  const source = await readPageSource();
  const modalStart = source.indexOf("const AnomalyDetailModal");
  const modalEnd = source.indexOf("const AnomalyTrackingPage", modalStart);
  const modalSource = source.slice(modalStart, modalEnd);

  assert.match(
    modalSource,
    /title=\{isBarangayScope && !hasSavedReview \? "Review Anomaly" : "Anomaly Details"\}/,
  );
  assert.match(
    modalSource,
    /const shouldShowReviewForm =\s*canRecordReview && \(!hasSavedReview \|\| \(!isBarangayScope && isEditingReview\)\)/,
  );
  assert.match(modalSource, /<div style=\{labelStyles\}>Review Result<\/div>/);
  assert.match(modalSource, /!isBarangayScope && canRecordReview && hasSavedReview/);
  assert.doesNotMatch(modalSource, /Edit Review/);
});

test("BRG-ANOM-L04 Sync Center rows keep recovery ownership outside Barangay review actions", async () => {
  const source = await readPageSource();

  assert.match(source, /return "Sync Center"/);
  assert.match(source, /row\?\.review_state === "sync_center"/);
  assert.doesNotMatch(source, /Retry Sync|Force Sync|Manual Sync|onRetry|onResolve|resolveSync/);
});

test("BRG-ANOM-L05 lifecycle table preserves the semantic responsive and pagination contracts", async () => {
  const source = await readPageSource();

  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.match(source, /const barangayAnomalyTableMinWidth = "1240px"/);
  assert.match(source, /tableLayout: "auto"/);
  assert.match(source, /\{paginationControls\}/);
});
