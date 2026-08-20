import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Relief distribution toolbar exposes mobile responsive grouping hooks", async () => {
  const [searchBarSource, pageSource, cssSource] = await Promise.all([
    readSource(["components", "stubs", "StubSearchBar.jsx"]),
    readSource(["pages", "barangay", "StubDistributionPage.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(searchBarSource, /className="stub-distribution-toolbar"/);
  assert.match(searchBarSource, /className="stub-distribution-toolbar-search"/);
  assert.match(searchBarSource, /className="stub-distribution-toolbar-controls"/);
  assert.match(searchBarSource, /className="stub-distribution-toolbar-actions"/);
  assert.match(pageSource, /<StubSearchBar[\s\S]*actions=\{/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-distribution-toolbar-search,[\s\S]*?\.stub-distribution-toolbar-controls,[\s\S]*?\.stub-distribution-toolbar-actions \{[\s\S]*?flex: 1 1 100% !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-distribution-toolbar-actions button/,
  );
});

test("Relief distribution table overflow remains scoped to the results table", async () => {
  const [tableSource, qrPanelSource, cssSource] = await Promise.all([
    readSource(["components", "stubs", "StubResultsTable.jsx"]),
    readSource(["components", "stubs", "QrCodePanel.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(tableSource, /className="stub-results-card"/);
  assert.match(tableSource, /className="stub-results-table-scroll"/);
  assert.match(tableSource, /className="stub-results-qr-cell"/);
  assert.match(tableSource, /showValue=\{false\}/);
  assert.match(tableSource, /value=\{row\.qr_code_value \|\| ""\}/);
  assert.match(qrPanelSource, /showValue = true/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-results-table-scroll \{[\s\S]*?overflow-x: auto !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-results-table-scroll table \{[\s\S]*?min-width: 920px;/,
  );
});

test("Relief distribution summary cards use balanced responsive columns", async () => {
  const [summarySource, cssSource] = await Promise.all([
    readSource(["components", "stubs", "StubSummaryCards.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(summarySource, /className="stub-summary-grid"/);
  assert.match(
    cssSource,
    /\.stub-summary-grid \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1100px\)[\s\S]*?\.stub-summary-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-summary-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
});

test("Relief distribution modals have phone-safe sizing and action hooks", async () => {
  const [claimSource, detailSource, scannerSource, cssSource] =
    await Promise.all([
      readSource(["components", "stubs", "StubClaimConfirmModal.jsx"]),
      readSource(["components", "stubs", "StubDetailModal.jsx"]),
      readSource(["components", "stubs", "StubQrScanModal.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(claimSource, /className="stub-claim-confirm-modal-backdrop"/);
  assert.match(claimSource, /className="stub-claim-confirm-actions"/);
  assert.match(detailSource, /className="stub-detail-modal-backdrop"/);
  assert.match(detailSource, /className="stub-detail-modal-topbar"/);
  assert.match(detailSource, /getDisasterEventTitle\(disasterEvent\)/);
  assert.doesNotMatch(detailSource, /disasterEvent\?\.id/);
  assert.match(scannerSource, /className="stub-qr-scan-modal-backdrop"/);
  assert.match(scannerSource, /className="stub-qr-scan-viewport"/);
  assert.match(scannerSource, /className="stub-qr-scan-video"/);
  assert.match(scannerSource, /className="stub-qr-scan-guide"/);
  assert.match(scannerSource, /const SCAN_REGION_RATIO = 0\.86;/);
  assert.match(scannerSource, /const SCAN_REGION_CANVAS_SIZE = 480;/);
  assert.match(scannerSource, /const getVisibleSourceRect = \(video, videoWidth, videoHeight\) =>/);
  assert.match(scannerSource, /const objectFit = window\.getComputedStyle\(video\)\.objectFit;/);
  assert.match(scannerSource, /objectFit !== "cover"/);
  assert.match(scannerSource, /sourceAspectRatio > renderedAspectRatio/);
  assert.match(
    scannerSource,
    /SCAN_REGION_RATIO \*[\s\S]*?Math\.min\([\s\S]*?visibleSourceRect\.width/,
  );
  assert.match(
    scannerSource,
    /calculateScanRegion: calculateGenerousScanRegion/,
  );
  assert.match(scannerSource, /overlay: overlayRef\.current/);
  assert.match(scannerSource, /role="status"/);
  assert.doesNotMatch(scannerSource, /disabled[\s\S]*Waiting for QR/);
  assert.match(
    cssSource,
    /\.stub-qr-scan-modal-topbar \{[\s\S]*?position: sticky;/,
  );
  assert.match(
    cssSource,
    /\.stub-qr-scan-modal-topbar \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/,
  );
  assert.match(cssSource, /\.stub-qr-scan-modal-heading \{[\s\S]*?min-width: 0;/);
  assert.match(
    cssSource,
    /\.stub-qr-scan-viewport \{[\s\S]*?width: 100%;[\s\S]*?aspect-ratio: 4 \/ 3;[\s\S]*?max-height: min\(48vh, 390px\);/,
  );
  assert.match(
    cssSource,
    /\.stub-qr-scan-video \{[\s\S]*?max-height: 100%;/,
  );
  assert.match(
    cssSource,
    /\.stub-qr-scan-guide \.scan-region-highlight-svg \{[\s\S]*?inset: 0;/,
  );
  assert.match(
    cssSource,
    /\.stub-qr-scan-status \{[\s\S]*?cursor: default;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-detail-modal-backdrop,[\s\S]*?\.stub-claim-confirm-modal-backdrop,[\s\S]*?\.stub-qr-scan-modal-backdrop \{[\s\S]*?padding: 12px !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-detail-modal,[\s\S]*?\.stub-claim-confirm-modal,[\s\S]*?\.stub-qr-scan-modal \{[\s\S]*?max-height: calc\(100vh - 24px\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-claim-confirm-actions,[\s\S]*?\.stub-qr-scan-actions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.stub-qr-scan-modal-topbar \{[\s\S]*?flex-wrap: nowrap !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.stub-qr-scan-viewport \{[\s\S]*?aspect-ratio: 1 \/ 1;[\s\S]*?max-height: min\(42vh, 320px\);/,
  );
});
