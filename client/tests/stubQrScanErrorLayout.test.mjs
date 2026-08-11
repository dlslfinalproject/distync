import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  QR_SCAN_ERROR_CODES,
  createQrScanError,
  getQrScanBlockingErrorConfig,
} from "../src/features/stubs/stubQrScanErrors.js";

test("invalid qr blocking config allows responsive wrapped messaging", () => {
  const config = getQrScanBlockingErrorConfig(
    createQrScanError({
      code: QR_SCAN_ERROR_CODES.INVALID_QR_STUB,
      message: "QR lookup did not return a valid stub record.",
    }),
  );

  assert.equal(config.title, "Invalid QR Stub");
  assert.equal(config.layout, "centeredAlert");
  assert.equal(config.messageStyle?.whiteSpace, undefined);
  assert.equal(config.messageStyle?.maxWidth, "360px");
});

test("wrong disaster event uses the centered alert layout without stub detail metadata", () => {
  const config = getQrScanBlockingErrorConfig(
    createQrScanError({
      code: QR_SCAN_ERROR_CODES.WRONG_EVENT,
      message:
        "This stub belongs to a different disaster event. Select the correct event before scanning.",
      details: {
        stubNumber: "STUB#1",
      },
    }),
  );

  assert.equal(config.title, "Wrong Disaster Event");
  assert.equal(config.layout, "centeredAlert");
  assert.equal(config.messageStyle?.maxWidth, "360px");
  assert.deepEqual(config.detailRows, []);
});

test("stub already claimed keeps the original card layout and removes only the close icon", () => {
  const config = getQrScanBlockingErrorConfig(
    createQrScanError({
      code: QR_SCAN_ERROR_CODES.STUB_ALREADY_CLAIMED,
      message: "Already claimed.",
      details: {
        stubNumber: "STUB#1",
        claimedAt: "2026-07-30T03:21:00.000Z",
        claimedByName: "Xy Talens",
        reliefPackName: "Standard Food Pack 1",
      },
    }),
  );

  assert.equal(config.title, "Stub Already Claimed");
  assert.equal(config.layout, undefined);
  assert.equal(config.showCloseButton, false);
  assert.equal(config.detailRows.length, 4);
  assert.equal(config.detailRows[0]?.label, "Stub Number");
  assert.equal(config.detailRows[1]?.label, "Claimed On");
  assert.equal(config.detailRows[2]?.label, "Claimed By");
  assert.equal(config.detailRows[3]?.label, "Relief Pack");
});

test("qr scan error modal centered alert styles constrain width and stack buttons on narrow viewports", async () => {
  const source = await fs.readFile(
    new URL("../src/components/stubs/StubQrScanErrorModal.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /width:\s*"100%"/);
  assert.match(source, /maxWidth:\s*"100%"/);
  assert.match(source, /showCloseButton=\{!isCenteredAlert && modalContent\.showCloseButton !== false\}/);
  assert.match(source, /gridTemplateColumns:\s*"repeat\(2, minmax\(0, 1fr\)\)"/);
  assert.match(source, /gridTemplateColumns:\s*"minmax\(0, 1fr\)"/);
});
