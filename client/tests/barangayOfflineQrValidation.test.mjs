import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  compareOfflineEventIdentity,
  compareOfflineIdentity,
  isRecognizedStubQrValue,
  OFFLINE_QR_IDENTITY_RESULTS,
} from "../src/features/stubs/offlineQrValidation.js";
import {
  QR_SCAN_ERROR_CODES,
  createQrScanError,
  getQrScanBlockingErrorConfig,
} from "../src/features/stubs/stubQrScanErrors.js";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("offline QR event validation matches normalized stable IDs", () => {
  assert.equal(
    compareOfflineEventIdentity({
      selectedEventId: " EVENT-A ",
      stubEventId: "event-a",
    }),
    OFFLINE_QR_IDENTITY_RESULTS.MATCH,
  );
  assert.equal(
    compareOfflineEventIdentity({
      selectedEventId: "event-a",
      stubEventId: "event-b",
    }),
    OFFLINE_QR_IDENTITY_RESULTS.MISMATCH,
  );
});

test("offline QR validation treats missing identity as unavailable, never as mismatch", () => {
  for (const values of [
    { selectedEventId: "", stubEventId: "event-a" },
    { selectedEventId: "event-a", stubEventId: undefined },
    { selectedEventId: null, stubEventId: null },
  ]) {
    assert.equal(
      compareOfflineEventIdentity(values),
      OFFLINE_QR_IDENTITY_RESULTS.UNAVAILABLE,
    );
  }

  assert.equal(
    compareOfflineIdentity({ expectedId: "barangay-a", actualId: "" }),
    OFFLINE_QR_IDENTITY_RESULTS.UNAVAILABLE,
  );
});

test("offline QR syntax is recognized before local lookup", () => {
  assert.equal(isRecognizedStubQrValue("DISTYNC-STUB|event-a|household-a|stub-a"), true);
  assert.equal(
    isRecognizedStubQrValue(
      "https://example.test/verify-stub?qr=DISTYNC-STUB%7Cevent-a%7Chousehold-a%7Cstub-a",
    ),
    true,
  );
  assert.equal(isRecognizedStubQrValue("not-a-distync-qr"), false);
});

test("offline verification unavailable has controlled user-facing copy", () => {
  const config = getQrScanBlockingErrorConfig(
    createQrScanError({
      code: QR_SCAN_ERROR_CODES.OFFLINE_VERIFICATION_UNAVAILABLE,
    }),
  );

  assert.equal(config.title, "Unable to Verify Offline");
  assert.equal(
    config.message,
    "The information required to verify this QR is not available on this device. Reconnect to the internet and try again.",
  );
  assert.doesNotMatch(config.message, /IndexedDB|API|UUID|stack|database/i);
});

test("Barangay QR page uses canonical offline validation and preserves safe failure states", async () => {
  const source = await readSource(
    "../src/pages/barangay/StubDistributionPage.jsx",
  );

  assert.match(source, /isOffline && !isRecognizedStubQrValue\(qrCodeValue\)/);
  assert.match(source, /compareOfflineEventIdentity\(\{/);
  assert.match(source, /eventIdentityResult === OFFLINE_QR_IDENTITY_RESULTS\.UNAVAILABLE/);
  assert.match(source, /eventIdentityResult === OFFLINE_QR_IDENTITY_RESULTS\.MISMATCH/);
  assert.match(source, /QR_SCAN_ERROR_CODES\.OFFLINE_VERIFICATION_UNAVAILABLE/);
  assert.doesNotMatch(source, /stubEventId !== selectedEvent\?\.id/);
});

test("cached QR details include visible local claim state", async () => {
  const source = await readSource("../src/features/stubs/stubCache.js");

  assert.match(source, /export const getCachedStubClaimSyncEntry = async/);
  assert.match(source, /toStubDetailsFromOfflineSnapshot\(cachedRow, syncEntry\)/);
  assert.match(source, /is_claim_pending: syncStatus === LOCAL_SYNC_STATUS\.PENDING/);
});

test("offline claim queue preserves event context and blocks local duplicates", async () => {
  const serviceSource = await readSource("../src/features/stubs/stubService.js");
  const pageSource = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(serviceSource, /assertNoBlockingLocalStubClaim/);
  assert.match(serviceSource, /actionKey:\s*"STUB_CLAIM"/);
  assert.match(serviceSource, /disaster_event_id: disasterEventId/);
  assert.match(pageSource, /QR_SCAN_ERROR_CODES\.STUB_CLAIM_PENDING/);
  assert.match(pageSource, /title: isOffline \? "QR Verified — Offline"/);
  assert.match(pageSource, /title: "Distribution saved offline"/);
});
