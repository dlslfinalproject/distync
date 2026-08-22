import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL(
  "../src/pages/mswdo/AnomalyTrackingPage.jsx",
  import.meta.url,
);
const serviceSourcePath = new URL(
  "../src/features/mswdo-reports/mswdoReportService.js",
  import.meta.url,
);
const presentationSourcePath = new URL(
  "../src/features/mswdo-reports/anomalyPresentation.js",
  import.meta.url,
);
const sidebarSourcePath = new URL(
  "../src/components/layout/Sidebar.jsx",
  import.meta.url,
);
const barangayLayoutSourcePath = new URL(
  "../src/components/layout/BarangayLayout.jsx",
  import.meta.url,
);

test("M05 anomaly page requests bounded server pages instead of the old 500-row fetch", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.doesNotMatch(source, /limit:\s*500/);
  assert.match(source, /page,\s*\n\s*pageSize,/);
  assert.match(source, /anomaly_type:\s*viewState\.anomaly_type === "all"/);
  assert.match(source, /review_state:\s*viewState\.status === "all"/);
  assert.match(source, /search:\s*viewState\.search\.trim\(\)/);
  assert.match(source, /order:\s*viewState\.order/);
  assert.doesNotMatch(source, /filteredRows/);
  assert.doesNotMatch(source, /\.sort\(\(firstRow,\s*secondRow\)/);
});

test("MSWDO-ANOM-I01 anomaly page exposes duplicate household registration label and filter id", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(
    presentationSource,
    /DUPLICATE_HOUSEHOLD_REGISTRATION:[\s\S]*label:\s*"Duplicate Household Registration"/,
  );
  assert.match(source, /availableAnomalyTypes/);
  assert.match(source, /formatAnomalyType\(row\.anomaly_type\)/);
  assert.doesNotMatch(source, />\{row\.anomaly_type\}</);
});

test("MSWDO-ANOM-I13 anomaly page exposes inventory-distribution mismatch label and filter id", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(
    presentationSource,
    /INVENTORY_DISTRIBUTION_MISMATCH:[\s\S]*label:\s*"Inventory-Distribution Mismatch"/,
  );
  assert.match(source, /formatAnomalyType\(row\.anomaly_type\)/);
});

test("M05 anomaly page resets pagination when result filters change", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const updateFilters = \(updater\) => \{\s*setPage\(1\);/);
  assert.match(source, /const updateViewState = \(updater\) => \{\s*setPage\(1\);/);
  assert.match(source, /setPage\(1\);\s*setPageSize\(Number\(event\.target\.value\)\)/);
});

test("M05 anomaly page renders accessible previous and next pagination controls", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /<button\s+type="button"[\s\S]*Previous/);
  assert.match(source, /disabled=\{!pagination\.hasPreviousPage \|\| isLoadingRows\}/);
  assert.match(source, /<button\s+type="button"[\s\S]*Next/);
  assert.match(source, /disabled=\{!pagination\.hasNextPage \|\| isLoadingRows\}/);
  assert.match(source, /Page \{pagination\.page\} of \{totalPages\}/);
});

test("M05F-09 anomaly page shows empty state without Page 0 of 0", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const shouldShowPaginationControls = totalItems > 0/);
  assert.match(source, /totalItems === 0[\s\S]*\? "No anomalies found"/);
  assert.match(source, /hasActiveFilters[\s\S]*"No anomalies found for the current filters\."/);
  assert.match(source, /"No unusual or inconsistent records currently require review\."/);
  assert.doesNotMatch(source, /Page \{totalPages === 0 \? 0 : pagination\.page\} of \{totalPages\}/);
  assert.match(
    source,
    /totalItems === 0\s*\? "No anomalies found"\s*:\s*`Showing \$\{firstVisibleItem\}-\$\{lastVisibleItem\} of \$\{totalItems\}`/,
  );
});

test("M05F-10 empty after filter reset clears stale page rows and keeps page valid", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const updateFilters = \(updater\) => \{\s*setPage\(1\);\s*setFilters\(updater\);/);
  assert.match(source, /const updateViewState = \(updater\) => \{\s*setPage\(1\);\s*setViewState\(updater\);/);
  assert.match(source, /setRows\(Array\.isArray\(response\.data\) \? response\.data : \[\]\)/);
  assert.match(source, /rows\.length === 0[\s\S]*<EmptyState/);
});

test("M05F-11 recover from empty restores non-empty pagination controls", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /setPagination\(\s*response\.pagination \|\|/);
  assert.match(source, /const shouldShowPaginationControls = totalItems > 0/);
  assert.match(source, /rows\.map\(\(row, rowIndex\) =>/);
  assert.match(source, /\{paginationControls\}/);
});

test("M05 anomaly service uses URLSearchParams for explicit query values", async () => {
  const source = await fs.readFile(serviceSourcePath, "utf8");

  assert.match(source, /new URLSearchParams\(\)/);
  assert.match(source, /Object\.entries\(filters\)/);
});

test("Barangay anomaly filters hide plain sync failures and hide technical source identity", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(presentationSource, /getAnomalyTypesForScope/);
  assert.match(presentationSource, /type\.value !== "SYNC_FAILED"/);
  assert.match(source, /getAnomalyTypesForScope\(scope\)/);
  assert.match(source, /!isBarangayScope \? \(/);
  assert.match(source, /Source ID:/);
  assert.match(source, /Anomaly[\s\S]*Affected Record[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/);
  assert.doesNotMatch(source, /Barangay action required:/);
});

test("Barangay anomaly page exposes review workflow without resolving sync conflicts there", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(serviceSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(source, /saveBarangayAnomalyReview/);
  assert.match(source, /manual_review_allowed === true/);
  assert.match(source, /Review Note/);
  assert.match(source, /Review in Sync Center/);
  assert.match(serviceSource, /\/api\/v1\/mswdo-reports\/anomalies\/reviews/);
  assert.match(presentationSource, /REVIEWED_VALID/);
  assert.match(presentationSource, /ISSUE_CONFIRMED/);
  assert.match(presentationSource, /REFERRED/);
  assert.match(presentationSource, /Automatically Handled/);
  assert.match(presentationSource, /Sync Center owns conflict resolution/);
});

test("Barangay review form requires an intentional outcome and custom note validation", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const REVIEW_NOTE_MAX_LENGTH = 2000/);
  assert.match(source, /const \[reviewStatus, setReviewStatus\] = useState\(""\)/);
  assert.match(source, /setReviewStatus\(anomaly\?\.review_status \|\| ""\)/);
  assert.match(source, /noValidate/);
  assert.doesNotMatch(source, /\srequired\s*[\r\n>]/);
  assert.match(source, /Review Outcome \*/);
  assert.match(source, /Please select a review outcome\./);
  assert.match(source, /Review Note \*/);
  assert.match(source, /Briefly describe what you verified and why you selected this outcome\./);
  assert.match(source, /Please enter a brief review note\./);
  assert.match(source, /Review note must be \$\{REVIEW_NOTE_MAX_LENGTH\} characters or fewer\./);
  assert.match(source, /aria-required="true"/);
  assert.match(source, /aria-invalid=\{Boolean\(reviewErrors\.resolutionReason\)\}/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /setReviewError\b|[^s]reviewError\b/);
});

test("Barangay review form keeps save visible and prevents duplicate submissions", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const modalShellSource = await fs.readFile(new URL(
    "../src/components/shared/FormModalShell.jsx",
    import.meta.url,
  ), "utf8");

  assert.match(source, /if \(isSubmittingReview\) \{[\s\S]*return;[\s\S]*\}/);
  assert.match(source, /disabled=\{isSaveDisabled\}/);
  assert.match(source, /aria-busy=\{isSubmittingReview\}/);
  assert.match(source, /form="barangay-anomaly-review-form"/);
  assert.match(source, /try \{[\s\S]*setIsSubmittingReview\(true\);[\s\S]*await saveBarangayAnomalyReview[\s\S]*\} catch \(error\) \{[\s\S]*\} finally \{[\s\S]*setIsSubmittingReview\(false\);[\s\S]*\}/);
  assert.match(source, /rows=\{3\}/);
  assert.match(source, /minHeight: "86px"/);
  assert.match(source, /footerStyle=\{modalFooterStyles\}/);
  assert.match(source, /const modalFooterStyles = \{[\s\S]*borderTop/);
  assert.match(modalShellSource, /\{footer \? <div style=\{\{ \.\.\.footerStyles, \.\.\.\(footerStyle \|\| \{\}\) \}\}\>\{footer\}<\/div> : null\}/);
});

test("Barangay review stale response is specific and refreshes authoritative anomalies", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(serviceSourcePath, "utf8");

  assert.match(serviceSource, /error\.statusCode = response\.status/);
  assert.match(serviceSource, /error\.code = payload\?\.code \|\| null/);
  assert.match(source, /STALE_REVIEW_MESSAGE/);
  assert.match(source, /ANOMALY_REVIEW_UNAVAILABLE/);
  assert.match(source, /ANOMALY_REVIEW_NOT_ALLOWED/);
  assert.match(source, /setIsReviewUnavailable\(true\)/);
  assert.match(source, /await onReviewStale\?\.\(\)/);
  assert.match(source, /onReviewStale=\{async \(\) => \{[\s\S]*setReloadToken/);
});

test("Barangay existing review opens read-only before explicit edit", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const \[isEditingReview, setIsEditingReview\] = useState\(false\)/);
  assert.match(source, /const hasSavedReview = Boolean\(displayedAnomaly\.review_status\)/);
  assert.match(source, /const shouldShowReviewForm = canRecordReview && \(!hasSavedReview \|\| isEditingReview\)/);
  assert.match(source, /Review Result/);
  assert.match(source, /Edit Review/);
  assert.match(source, /Save Changes/);
  assert.match(source, /const reviewHasChanges =/);
  assert.match(source, /hasSavedReview && isEditingReview && !reviewHasChanges/);
  assert.match(source, /setIsEditingReview\(false\)/);
});

test("Barangay anomaly list uses one horizontally scrollable table representation", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const barangayAnomalyTableMinWidth = "1040px"/);
  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.match(source, /minWidth: isBarangayScope \? barangayAnomalyTableMinWidth : undefined/);
  assert.match(source, /Anomaly[\s\S]*Affected Record[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/);
  assert.match(source, /barangayAnomalyColumnStyles\.whyFlagged/);
  assert.doesNotMatch(source, /barangayListLayout|viewportWidth|getInitialViewportWidth/);
  assert.doesNotMatch(source, /anomalyCardStyles|compactRecordStyles|<article/);
  assert.doesNotMatch(source, /Anomaly \/ Record/);
  const barangayHeaderStart = source.indexOf("{isBarangayScope ? (");
  const mswdoHeaderStart = source.indexOf(") : (", barangayHeaderStart);
  const barangayHeaderBlock = source.slice(barangayHeaderStart, mswdoHeaderStart);

  assert.notEqual(barangayHeaderStart, -1);
  assert.notEqual(mswdoHeaderStart, -1);
  assert.doesNotMatch(
    barangayHeaderBlock,
    />Barangay<\/th>|>Disaster Event<\/th>|>Responsible Office<\/th>|>Action Required<\/th>|>Technical Reference<\/th>/,
  );
  assert.doesNotMatch(source, /wordBreak: "break-all"/);
  assert.match(source, /overflowWrap: "normal"/);
  assert.doesNotMatch(source, /overflowWrap: "anywhere"/);
  assert.doesNotMatch(source, /tableLayout: "fixed"/);
});

test("Barangay anomaly details separates metadata fields instead of flowing paragraphs", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const DetailField = \(\{ label, children \}\) =>/);
  assert.match(source, /<strong style=\{\{ \.\.\.modalStyles\.value, fontSize: "16px" \}\}>\{presentation\.label\}<\/strong>/);
  assert.match(source, /<StatusPill row=\{displayedAnomaly\} \/>/);
  assert.doesNotMatch(source, /<div style=\{labelStyles\}>Status<\/div>/);
  assert.match(source, /<DetailField label="Disaster Event">[\s\S]*\{formatEventLabel\(displayedAnomaly\)\}/);
  assert.match(source, /<DetailField label="Affected Record">[\s\S]*\{formatAffectedRecord\(displayedAnomaly\)\}/);
  assert.match(source, /<DetailField label="Detected At">[\s\S]*\{formatDateTime\(displayedAnomaly\.occurred_at\)\}/);
  assert.match(source, /<DetailField label="Recommendation">[\s\S]*\{getAnomalyActionSummary\(displayedAnomaly\)\}/);
  assert.match(source, /<DetailField label="Responsible Office">[\s\S]*\{getAnomalyOwner\(displayedAnomaly\)\}/);
  assert.match(source, /<DetailField label="Outcome">[\s\S]*\{formatReviewOutcome\(displayedAnomaly\.review_status\)\}/);
  assert.match(source, /<DetailField label="Reviewed By">[\s\S]*\{displayedAnomaly\.reviewer_name \|\| "Not available"\}/);
  assert.match(source, /<DetailField label="Reviewed At">[\s\S]*\{formatDateTime\(displayedAnomaly\.reviewed_at\)\}/);
  assert.match(source, /<DetailField label="Review Note">[\s\S]*\{displayedAnomaly\.resolution_reason \|\| "Not available"\}/);
  assert.doesNotMatch(source, /Disaster Event:|Affected Record:|Detected:|Responsible office:|Outcome:|Reviewed by:|Reviewed at:|Review Note:/);
  assert.doesNotMatch(source, /displayedAnomaly\.reviewer_name \|\| displayedAnomaly\.reviewed_by/);
});

test("Barangay anomaly page removes summary cards, sync banner, and extra row review action", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const sidebarSource = await fs.readFile(sidebarSourcePath, "utf8");
  const layoutSource = await fs.readFile(barangayLayoutSourcePath, "utf8");

  assert.match(sidebarSource, /\{ label: "Anomaly Tracking", to: "\/barangay\/anomalies" \}/);
  assert.match(sidebarSource, /\{ label: "Anomaly Tracking Management", to: "\/mswdo\/anomalies" \}/);
  assert.match(layoutSource, /isBarangayAnomalyRoute/);
  assert.match(layoutSource, /!isBarangayAnomalyRoute \? <SyncStatusBanner \/> : null/);
  assert.match(source, /!\isBarangayScope \? \([\s\S]*<StatusCard label="Total Detected"/);
  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.doesNotMatch(source, /FiCheckCircle|FiEdit3/);
});
