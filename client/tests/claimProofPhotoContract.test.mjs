import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readClientSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Barangay claim confirmation offers QR or Photo Proof and confirms only a prepared photo", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /Photo Proof/);
  assert.match(source, /setProofType\("PHOTO"\);[\s\S]*Photo Proof/);
  assert.doesNotMatch(source, /setProofType\("PHOTO"\)[\s\S]{0,160}qrReferenceValue/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /Choose proof method/);
  assert.match(source, /Scan the household distribution Stub QR code/);
  assert.match(source, /Capture a photo as proof that the relief goods were received/);
  assert.match(source, /Take Photo/);
  assert.match(source, /Capture Photo/);
  assert.match(source, /Choose from Device/);
  assert.match(source, /Photo guidelines/);
  assert.match(source, /showing the recipient and the relief goods being handed over/);
  assert.match(source, /alt="Claim handoff proof preview"/);
  assert.match(source, /Photo ready for this distribution/);
  assert.match(source, /Retake Photo/);
  assert.match(source, /Choose Another Photo/);
  assert.match(source, /normalizeImageDrawableToDataUrl\([\s\S]*?maxDimension: 1600[\s\S]*?maxOutputBytes: 2 \* 1024 \* 1024/);
  assert.match(source, /normalizeImageFileToDataUrl\(selectedFile/);
  assert.match(source, /isProofPhotoReady/);
  assert.match(source, /onConfirm\?\.\(\{\s*proofType: "PHOTO"/);
  assert.match(source, /Confirm Distribution/);
  assert.match(source, /Processing distribution/);
  assert.match(source, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(source, /className="claim-proof-file-input"[\s\S]*type="file"[\s\S]*accept="image\/\*"/);
  assert.match(source, /disabled=\{[\s\S]*?selectedCount === 1[\s\S]*?isProofPhotoReady/);
  assert.doesNotMatch(source, /Use Photo/);
});

test("camera cancellation and method changes discard pending photo and stop tracks", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /if \(!isOpen\)\s*\{[\s\S]*?captureRequestRef\.current \+= 1;[\s\S]*?setProofPhotoDataUrl\(""\);/);
  assert.match(source, /stream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /if \(cancelled\) \{\s*stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /requestId !== captureRequestRef\.current/);
  assert.match(source, /proofType !== "PHOTO"/);
  assert.match(source, /setProofType\("QR"\);\s*setProofPhotoDataUrl\(""\);/);
  assert.match(source, /submissionStartedRef\.current = true/);
  assert.match(source, /Camera unavailable\. Choose a photo from this device or try again\./);
});

test("claim proof layout keeps controls and preview usable on narrow and short screens", async () => {
  const source = await readClientSource("src/index.css");

  assert.match(source, /\.claim-proof-method-options[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /@media \(max-width: 520px\)[\s\S]*\.claim-proof-method-options,[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(source, /\.claim-proof-photo-preview[\s\S]*object-fit: contain/);
  assert.match(source, /@media \(max-height: 620px\)[\s\S]*\.stub-claim-confirm-modal[\s\S]*max-height: calc\(100dvh - 16px\)/);
  assert.match(source, /@media \(max-height: 620px\) and \(orientation: landscape\)/);
});

test("claim payload uses one durable sync identity and refuses unprepared offline context", async () => {
  const source = await readClientSource("src/features/stubs/stubService.js");

  assert.match(source, /actionKey: "STUB_CLAIM"/);
  assert.match(source, /persistBeforeRequest: true/);
  assert.match(source, /client_sync_id: clientSyncId/);
  assert.match(source, /\/api\/v1\/sync\/process/);
  assert.match(source, /isOfflineClaimLocallyReady\(/);
  assert.match(source, /details\.status !== "ISSUED"/);
  assert.match(source, /attendanceStatus !== "PRESENT"/);
  assert.match(source, /!hasStandardPack/);
  assert.match(source, /return proofType === "PHOTO"/);
  assert.doesNotMatch(source, /\/api\/v1\/stubs\/\$\{stubId\}\/claim/);
});
