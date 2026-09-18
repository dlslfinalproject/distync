import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath) =>
  fs.readFileSync(new URL(relativePath, new URL("../src/", import.meta.url)), "utf8");

const barangaySource = readSource("pages/barangay/StubDistributionPage.jsx");
const mswdoSource = readSource("pages/mswdo/StubDistributionPage.jsx");
const scannerSource = readSource("components/stubs/StubQrScanModal.jsx");
const toastSource = readSource("components/shared/FeedbackToast.jsx");

test("QR claim confirmation is independent of toast and scanner cleanup", () => {
  assert.match(barangaySource, /isOpen=\{Boolean\(pendingClaimStubId\) \|\| isBulkClaimConfirmOpen\}/);
  assert.match(mswdoSource, /isOpen=\{Boolean\(pendingClaimStubId\) \|\| isBulkClaimConfirmOpen\}/);
  assert.match(barangaySource, /setIsQrScanModalOpen\(false\);[\s\S]*setScanToast\(/);
  assert.match(mswdoSource, /setIsQrScanModalOpen\(false\);[\s\S]*setScanToast\(/);
  assert.match(scannerSource, /scanner\.stop\(\);\s*scanner\.destroy\(\);/);
  assert.match(toastSource, /window\.setTimeout\(\(\) => \{\s*onClose\(\);/);
});

test("MSWDO refresh reconciliation does not clear an active confirmation", () => {
  assert.match(
    mswdoSource,
    /useEffect\(\(\) => \{\s*if \(pendingClaimStubId \|\| isBulkClaimConfirmOpen\) \{\s*return;\s*\}/,
  );
  assert.match(
    mswdoSource,
    /\[\s*activeTab,\s*isBulkClaimConfirmOpen,\s*pendingClaimStubId,\s*selectedBarangayId,\s*selectedDisasterEventId,\s*\]/,
  );
});

test("Barangay event reconciliation does not clear an active confirmation", () => {
  assert.match(
    barangaySource,
    /useEffect\(\(\) => \{\s*if \(pendingClaimStubId \|\| isBulkClaimConfirmOpen\) \{\s*return;\s*\}/,
  );
  assert.match(
    barangaySource,
    /\[\s*isBulkClaimConfirmOpen,\s*isSelectedEventEnded,\s*pendingClaimStubId,\s*selectedEvent\?\.id,\s*\]/,
  );
});

test("explicit Cancel remains the claim-state close path", () => {
  assert.match(
    barangaySource,
    /const handleCancelClaim = \(\) => \{[\s\S]*setPendingClaimStubId\(""\);[\s\S]*setPendingClaimStubDetails\(null\);/,
  );
  assert.match(
    mswdoSource,
    /const handleCancelClaim = \(\) => \{[\s\S]*setPendingClaimStubId\(""\);[\s\S]*setPendingClaimStubDetails\(null\);/,
  );
});
