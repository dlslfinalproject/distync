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
  assert.match(
    presentationSource,
    /DUPLICATE_HOUSEHOLD_REGISTRATION:[\s\S]*nextStep:\s*"Compare the affected household records and coordinate identity validation with the Barangay\."/,
  );
  assert.doesNotMatch(
    presentationSource,
    /MSWDO_ANOMALY_PRESENTATION_OVERRIDES[\s\S]*DUPLICATE_HOUSEHOLD_REGISTRATION:[\s\S]*label:\s*"Duplicate Household Record"/,
  );
  assert.match(source, /availableAnomalyTypes/);
  assert.match(source, /formatAnomalyType\(row\.anomaly_type, presentationScope\)/);
  assert.doesNotMatch(source, />\{row\.anomaly_type\}</);
});

test("MSWDO-ANOM-I13 anomaly page exposes inventory-distribution mismatch label and filter id", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(
    presentationSource,
    /INVENTORY_DISTRIBUTION_MISMATCH:[\s\S]*label:\s*"Inventory-Distribution Mismatch"/,
  );
  assert.match(source, /formatAnomalyType\(row\.anomaly_type, presentationScope\)/);
});

test("MSWDO consolidated table uses the required operational columns in order", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const tableHeadStart = source.indexOf("<thead>");
  const mswdoHeaderStart = source.indexOf(") : (", tableHeadStart);
  const mswdoHeaderEnd = source.indexOf(")}", mswdoHeaderStart);
  const mswdoHeaderBlock = source.slice(mswdoHeaderStart, mswdoHeaderEnd);

  assert.notEqual(tableHeadStart, -1);
  assert.notEqual(mswdoHeaderStart, -1);
  assert.match(
    mswdoHeaderBlock,
    /Anomaly Type[\s\S]*Barangay[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/,
  );
  assert.doesNotMatch(
    mswdoHeaderBlock,
    /Severity|>Status<|Created Date|Action Required|Responsible Office|Household \/ Stub/,
  );
  assert.doesNotMatch(source, /SeverityPill|getAnomalySeverity/);
  assert.match(source, /formatBarangayLabel\(row\)/);
  assert.match(source, /formatAffectedRecord\(row, false\)/);
});

test("MSWDO filters and search expose municipal operational fields", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /<label htmlFor="anomaly-barangay"[\s\S]*Barangay/);
  assert.match(source, /<option value="">All Barangays<\/option>/);
  assert.match(source, /barangay_id: isBarangayScope[\s\S]*: filters\.barangay_id/);
  assert.match(
    source,
    /Search anomaly type, Barangay, affected record, event, reason, review status, or notes/,
  );
  assert.match(source, /const mswdoStatusFilters = \[/);
});

test("MSWDO details support result recording without technical identifiers or sync actions", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");
  const modalStart = source.indexOf("const AnomalyDetailModal");
  const modalEnd = source.indexOf("const AnomalyTrackingPage", modalStart);
  const modalSource = source.slice(modalStart, modalEnd);

  assert.match(source, /mswdoReviewOutcomeOptions/);
  assert.match(source, /saveAnomalyReview/);
  assert.match(source, /Record Review/);
  assert.match(source, /Note \*/);
  assert.match(source, /const formatReviewNote = \(value\) => getNormalizedReviewNote\(value\) \|\| "Not provided"/);
  assert.match(source, /Review Status/);
  assert.match(source, /Reviewed By/);
  assert.match(source, /Reviewed At/);
  assert.match(source, /!reviewHasChanges/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Context<\/div>/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Recommended Action<\/div>/);
  assert.doesNotMatch(modalSource, /<div style=\{labelStyles\}>Review Result<\/div>/);
  assert.doesNotMatch(modalSource, /<DetailField label="Responsible Office">/);
  assert.doesNotMatch(modalSource, /Review Note/);
  assert.match(modalSource, /<DetailField label="Recommendation">/);
  assert.match(modalSource, /<DetailField label="Note" fullWidth>/);
  assert.match(modalSource, /!isBarangayScope \? \([\s\S]*<DetailField label="Barangay">/);
  assert.match(presentationSource, /Synchronization Conflict Detected/);
  assert.doesNotMatch(source, /Technical Reference|Source ID:|Retry Sync|Force Sync|Manual Sync/);
});

test("MSWDO reviewed anomalies remain read-only while the shared Barangay edit path stays scoped", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(
    source,
    /const canEditSavedReview =\s+isBarangayScope && canRecordReview && hasSavedReview/,
  );
  assert.match(
    source,
    /const shouldShowReviewForm =\s+canRecordReview && \(!hasSavedReview \|\| \(isBarangayScope && isEditingReview\)\)/,
  );
  assert.match(source, /\) : canEditSavedReview \? \(/);
  assert.match(source, /if \(!canEditSavedReview\) \{[\s\S]*return;/);
  assert.doesNotMatch(source, /<div style=\{labelStyles\}>Review Result<\/div>/);
  assert.match(source, /FiEye/);
  assert.doesNotMatch(source, /FiEdit|FiEdit2|FiEdit3|MdEdit/);
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
  assert.doesNotMatch(source, /Technical Reference|Source ID:/);
  assert.match(source, /Anomaly Type[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/);
  assert.doesNotMatch(source, /Barangay action required:/);
});

test("Barangay anomaly page exposes review workflow without resolving sync conflicts there", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(serviceSourcePath, "utf8");
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");

  assert.match(source, /saveAnomalyReview/);
  assert.match(source, /manual_review_allowed === true/);
  assert.match(source, /Note/);
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
  assert.match(source, /Note \*/);
  assert.match(source, /Briefly describe what you verified and why you selected this outcome\./);
  assert.match(source, /Note is required\./);
  assert.match(source, /Note must be \$\{REVIEW_NOTE_MAX_LENGTH\} characters or fewer\./);
  assert.match(source, /currentReviewNote\.length > 0/);
  assert.match(source, /getNormalizedReviewNote\(resolutionReason\)/);
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
  assert.match(source, /form="anomaly-review-form"/);
  assert.match(source, /try \{[\s\S]*setIsSubmittingReview\(true\);[\s\S]*await saveAnomalyReview[\s\S]*\} catch \(error\) \{[\s\S]*\} finally \{[\s\S]*setIsSubmittingReview\(false\);[\s\S]*\}/);
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
  assert.match(source, /BARANGAY_STALE_REVIEW_MESSAGE/);
  assert.match(source, /ANOMALY_REVIEW_UNAVAILABLE/);
  assert.match(source, /ANOMALY_REVIEW_NOT_ALLOWED/);
  assert.match(source, /setIsReviewUnavailable\(true\)/);
  assert.match(source, /await onReviewStale\?\.\(\)/);
  assert.match(source, /onReviewStale=\{async \(\) => \{[\s\S]*setReloadToken/);
});

test("reviewed MSWDO details remain read-only while Barangay retains explicit edit", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const \[isEditingReview, setIsEditingReview\] = useState\(false\)/);
  assert.match(source, /const hasSavedReview = Boolean\(displayedAnomaly\.review_status\)/);
  assert.match(source, /const shouldShowReviewForm =\s+canRecordReview && \(!hasSavedReview \|\| \(isBarangayScope && isEditingReview\)\)/);
  assert.match(source, /const canEditSavedReview =\s+isBarangayScope && canRecordReview && hasSavedReview/);
  assert.doesNotMatch(source, /<div style=\{labelStyles\}>Review Result<\/div>/);
  assert.doesNotMatch(source, /!isBarangayScope && canRecordReview && hasSavedReview/);
  assert.match(source, /Edit Review/);
  assert.match(source, /const reviewHasChanges =/);
  assert.match(source, /hasSavedReview && isEditingReview && !reviewHasChanges/);
  assert.match(source, /setIsEditingReview\(false\)/);
});

test("Barangay anomaly list uses one horizontally scrollable table representation", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const barangayAnomalyTableMinWidth = "1040px"/);
  assert.match(source, /const mswdoAnomalyTableMinWidth = "1320px"/);
  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.match(source, /minWidth: isBarangayScope[\s\S]*\? barangayAnomalyTableMinWidth[\s\S]*: mswdoAnomalyTableMinWidth/);
  assert.match(source, /Anomaly Type[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Why Flagged[\s\S]*Review Status[\s\S]*Detected At[\s\S]*Action/);
  assert.match(source, /barangayAnomalyColumnStyles\.whyFlagged/);
  assert.doesNotMatch(source, /barangayListLayout|viewportWidth|getInitialViewportWidth/);
  assert.doesNotMatch(source, /anomalyCardStyles|compactRecordStyles|<article/);
  assert.doesNotMatch(source, /Anomaly \/ Record/);
  const tableHeadStart = source.indexOf("<thead>");
  const barangayHeaderStart = source.indexOf("{isBarangayScope ? (", tableHeadStart);
  const mswdoHeaderStart = source.indexOf(") : (", barangayHeaderStart);
  const barangayHeaderBlock = source.slice(barangayHeaderStart, mswdoHeaderStart);

  assert.notEqual(barangayHeaderStart, -1);
  assert.notEqual(mswdoHeaderStart, -1);
  assert.doesNotMatch(
    barangayHeaderBlock,
    />Barangay<\/th>|>Responsible Office<\/th>|>Action Required<\/th>|>Technical Reference<\/th>/,
  );
  assert.doesNotMatch(source, /wordBreak: "break-all"/);
  assert.match(source, /overflowWrap: "normal"/);
  assert.doesNotMatch(source, /overflowWrap: "anywhere"/);
  assert.doesNotMatch(source, /tableLayout: "fixed"/);
});

test("Barangay anomaly details separates metadata fields instead of flowing paragraphs", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const DetailField = \(\{ label, children, fullWidth = false \}\) =>/);
  assert.match(source, /<strong style=\{\{ \.\.\.modalStyles\.value, fontSize: "16px" \}\}>\{presentation\.label\}<\/strong>/);
  assert.match(source, /<StatusPill row=\{displayedAnomaly\} scope=\{presentationScope\} \/>/);
  assert.doesNotMatch(source, /<div style=\{labelStyles\}>Status<\/div>/);
  assert.match(source, /<DetailField label="Disaster Event">[\s\S]*\{formatEventLabel\(displayedAnomaly\)\}/);
  assert.match(source, /<DetailField label="Affected Record">[\s\S]*\{formatAffectedRecord\(displayedAnomaly, isBarangayScope\)\}/);
  assert.match(source, /<DetailField label="Detected At">[\s\S]*\{formatDateTime\(displayedAnomaly\.detected_at\)\}/);
  assert.match(source, /<DetailField label="Recommendation">[\s\S]*\{getAnomalyActionSummary\(displayedAnomaly, presentationScope\)\}/);
  assert.doesNotMatch(source, /<DetailField label="Responsible Office">/);
  assert.match(source, /<DetailField label="Outcome">[\s\S]*formatReviewOutcome\([\s\S]*displayedAnomaly\.review_status,[\s\S]*presentationScope/);
  assert.match(source, /<DetailField label="Reviewed By">[\s\S]*\{displayedAnomaly\.reviewer_name \|\| "Not available"\}/);
  assert.match(source, /<DetailField label="Reviewed At">[\s\S]*\{formatDateTime\(displayedAnomaly\.reviewed_at\)\}/);
  assert.match(source, /<DetailField label="Note" fullWidth>[\s\S]*\{formatReviewNote\(displayedAnomaly\.resolution_reason\)\}/);
  assert.match(source, /const DetailField = \(\{ label, children, fullWidth = false \}\)/);
  assert.match(source, /fullWidth \? \{ gridColumn: "1 \/ -1" \}/);
  assert.doesNotMatch(source, /Disaster Event:|Affected Record:|Detected:|Responsible office:|Outcome:|Reviewed by:|Reviewed at:|Review Note:/);
  assert.doesNotMatch(source, /displayedAnomaly\.reviewer_name \|\| displayedAnomaly\.reviewed_by/);
});

test("MSWDO anomaly details keeps Barangay context without a redundant Context heading", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const modalStart = source.indexOf("const AnomalyDetailModal");
  const contextStart = source.indexOf('<div style={modalStyles.fieldGrid}>', modalStart);
  const whyFlaggedStart = source.indexOf('<div style={labelStyles}>Why Flagged</div>', contextStart);
  const contextBlock = source.slice(contextStart, whyFlaggedStart);

  assert.notEqual(contextStart, -1);
  assert.notEqual(whyFlaggedStart, -1);
  assert.match(contextBlock, /Disaster Event/);
  assert.match(contextBlock, /Affected Record/);
  assert.match(contextBlock, /Detected At/);
  assert.match(contextBlock, /<DetailField label="Barangay">/);
  assert.doesNotMatch(contextBlock, /Review Status/);
  assert.doesNotMatch(source, /<div style=\{labelStyles\}>Context<\/div>/);
});

test("MSWDO reviewed presentation separates lifecycle status from persisted outcome", async () => {
  const [source, presentationSource] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(presentationSourcePath, "utf8"),
  ]);
  const presentation = await import(
    `data:text/javascript,${encodeURIComponent(presentationSource)}`,
  );
  const reviewedAnomaly = {
    anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
    review_state: "reviewed",
    review_status: "REVIEWED_VALID",
    family_head_name: "Daniel Padilla",
  };

  assert.equal(
    presentation.getAnomalyReviewStatusLabel(reviewedAnomaly, "mswdo"),
    "Resolved",
  );
  assert.equal(
    presentation.formatReviewOutcome(reviewedAnomaly.review_status, "mswdo"),
    "Dismissed / No Issue",
  );
  assert.equal(
    presentation.formatAnomalyType(
      reviewedAnomaly.anomaly_type,
      "barangay",
    ),
    presentation.formatAnomalyType(reviewedAnomaly.anomaly_type, "mswdo"),
  );
  assert.equal(
    presentation.formatAffectedRecord(reviewedAnomaly, true),
    "Daniel Padilla",
  );
  assert.equal(
    presentation.formatAffectedRecord(reviewedAnomaly, false),
    "Daniel Padilla",
  );
  assert.match(source, /<StatusPill row=\{displayedAnomaly\} scope=\{presentationScope\} \/>/);
  assert.match(source, /<DetailField label="Outcome">[\s\S]*formatReviewOutcome\(/);
  assert.match(source, /<DetailField label="Note" fullWidth>/);
});

test("MSWDO review-status presentation does not derive lifecycle status from outcome labels", async () => {
  const presentationSource = await fs.readFile(presentationSourcePath, "utf8");
  const stateFunction = presentationSource.match(
    /export const getAnomalyReviewStateLabel = \(row, scope = "barangay"\) => \{[\s\S]*?\n\};/,
  )?.[0] || "";

  assert.match(stateFunction, /return "Resolved"/);
  assert.doesNotMatch(stateFunction, /formatReviewOutcome\(/);
  assert.match(presentationSource, /export const getAnomalyReviewStatusLabel/);
});

test("Barangay anomaly page removes summary cards, sync banner, and extra row review action", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const sidebarSource = await fs.readFile(sidebarSourcePath, "utf8");
  const layoutSource = await fs.readFile(barangayLayoutSourcePath, "utf8");

  assert.match(sidebarSource, /\{ label: "Anomaly Tracking", to: "\/barangay\/anomalies"(?:, isSectionChild: true)? \}/);
  assert.match(sidebarSource, /\{ label: "Anomaly Tracking", to: "\/mswdo\/anomalies" \}/);
  assert.match(layoutSource, /isBarangayAnomalyRoute/);
  assert.match(layoutSource, /shouldShowSyncStatusBanner/);
  assert.match(layoutSource, /\{shouldShowSyncStatusBanner \? <SyncStatusBanner \/> : null\}/);
  assert.match(source, /!\isBarangayScope \? \([\s\S]*<StatusCard label="Total Detected"/);
  assert.match(source, /overflowX: "auto", width: "100%", minWidth: 0/);
  assert.match(source, /const isManualReviewableAnomaly = \(row\) => row\?\.manual_review_allowed === true/);
  assert.match(source, /isManualReviewableAnomaly\(row\) \? \([\s\S]*>\s*Review\s*<\/button>/);
  assert.match(source, /getAnomalyRowActionLabel\(row\)/);
  assert.match(source, /return "Sync Center"/);
  assert.match(source, /return "No review needed"/);
  assert.doesNotMatch(source, /FiAlertTriangle|View details/);
  assert.doesNotMatch(source, /FiCheckCircle|FiEdit3/);
});

test("resolved anomaly rows use the eye details action for both scopes", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const actionBlock = source.match(
    /\{isManualReviewableAnomaly\(row\) && row\.review_status \? \([\s\S]*?\) : isManualReviewableAnomaly\(row\) \? \(/,
  )?.[0] || "";

  assert.match(actionBlock, /<FiEye size=\{18\} aria-hidden="true" \/>/);
  assert.match(actionBlock, /aria-label="View anomaly details"/);
  assert.match(source, /aria-label="Review anomaly"/);
  assert.doesNotMatch(actionBlock, /isBarangayScope &&/);
});

test("Barangay sidebar groups sync and anomaly navigation under Monitoring only", async () => {
  const sidebarSource = await fs.readFile(sidebarSourcePath, "utf8");

  const barangayNavBlock =
    sidebarSource.match(/\[ROLE_CODES\.BARANGAY\]: \{[\s\S]*?navItems: \[([\s\S]*?)\],/)?.[1] || "";
  const mswdoNavBlock =
    sidebarSource.match(/\[ROLE_CODES\.MSWDO\]: \{[\s\S]*?navItems: \[([\s\S]*?)\],/)?.[1] || "";
  const mayorNavBlock =
    sidebarSource.match(/\[ROLE_CODES\.MAYOR\]: \{[\s\S]*?navItems: \[([\s\S]*?)\],/)?.[1] || "";
  const monitoringIndex = barangayNavBlock.indexOf('{ type: "section", label: "Monitoring" }');
  const syncIndex = barangayNavBlock.indexOf('{ label: "Sync Center", to: "/barangay/sync", isSectionChild: true }');
  const anomalyIndex = barangayNavBlock.indexOf('{ label: "Anomaly Tracking", to: "/barangay/anomalies", isSectionChild: true }');

  assert.notEqual(monitoringIndex, -1);
  assert.notEqual(syncIndex, -1);
  assert.notEqual(anomalyIndex, -1);
  assert.ok(monitoringIndex < syncIndex);
  assert.ok(syncIndex < anomalyIndex);
  assert.match(sidebarSource, /item\.type === "section"[\s\S]*className="distync-sidebar__nav-section-label"/);
  assert.match(sidebarSource, /display: isCollapsed \? "none" : sidebarStyles\.navSectionLabel\.display/);
  assert.match(sidebarSource, /marginLeft: item\.isSectionChild && !isCollapsed \? "8px" : 0/);
  assert.doesNotMatch(sidebarSource, /\/barangay\/monitoring/);
  assert.doesNotMatch(mswdoNavBlock, /type: "section", label: "Monitoring"/);
  assert.doesNotMatch(mayorNavBlock, /type: "section", label: "Monitoring"/);
});
