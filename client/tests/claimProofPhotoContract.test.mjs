import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolveClaimProof } from "../src/features/stubs/claimProofWorkflow.js";

const readClientSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("claim confirmation automatically uses active QR and requires Photo Proof only as fallback", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");
  const [qrProof, photoFallback, inactiveQrFallback, loadingProof] = [
    resolveClaimProof({
      stubDetails: { id: "stub-1", qr_code_value: "qr-1", qr_status: "ACTIVE" },
    }),
    resolveClaimProof({ stubDetails: { id: "stub-2", qr_code_value: null } }),
    resolveClaimProof({
      stubDetails: { id: "stub-3", qr_code_value: "qr-3", qr_status: "INACTIVE" },
    }),
    resolveClaimProof({
      stubDetails: null,
      isLoadingStubDetails: true,
    }),
  ];

  assert.equal(qrProof.proofType, "QR");
  assert.equal(qrProof.qrReferenceValue, "qr-1");
  assert.equal(photoFallback.proofType, "PHOTO");
  assert.equal(photoFallback.qrReferenceValue, "");
  assert.equal(inactiveQrFallback.proofType, "PHOTO");
  assert.equal(inactiveQrFallback.qrReferenceValue, "");
  assert.equal(loadingProof.proofType, "");
  assert.match(source, /resolveClaimProof\(/);
  assert.doesNotMatch(source, /allowPhotoProof/);
  assert.match(source, /Photo Proof Required/);
  assert.doesNotMatch(source, /Choose proof method/);
  assert.doesNotMatch(source, /type="radio"/);
  assert.doesNotMatch(source, /setProofType/);
  assert.match(source, /<QrCodePanel[\s\S]*?value=\{resolvedQrReferenceValue\}/);
  assert.match(source, /proofType === "QR" && resolvedQrReferenceValue/);
  assert.match(source, /proofPhotoDataUrl: ""/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /QR proof is unavailable for this distribution/);
  assert.match(source, /Take Photo/);
  assert.match(source, /Open Camera/);
  assert.match(source, /Capture Photo/);
  assert.match(source, /Choose from Device/);
  assert.match(source, /Photo guidelines/);
  assert.match(source, /showing the recipient and the relief goods being handed over/);
  assert.match(source, /alt="Claim handoff proof preview"/);
  assert.match(source, /Photo ready/);
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
  assert.match(source, /const isConfirmDisabled =/);
  assert.match(source, /disabled=\{isConfirmDisabled\}/);
  assert.doesNotMatch(source, /Use Photo/);
});

test("MSWDO row confirmation uses the shared automatic proof workflow", async () => {
  const source = await readClientSource("src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(source, /const handleOpenClaimConfirmation = \(stubId\) =>/);
  assert.match(source, /setPendingClaimStubId\(stubId\)/);
  assert.match(source, /fetchStubDetails\(pendingClaimStubId\)/);
  assert.match(source, /<StubClaimConfirmModal[\s\S]*?stubDetails=\{pendingClaimStubDetails\}/);
  assert.doesNotMatch(source, /allowPhotoProof|must start with a verified QR scan/);
});

test("camera cancellation and retake discard drafts and stop tracks safely", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /if \(!isOpen\)\s*\{[\s\S]*?captureRequestRef\.current \+= 1;[\s\S]*?setProofPhotoDataUrl\(""\);/);
  assert.match(source, /stream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /if \(cancelled\) \{\s*stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /requestId !== captureRequestRef\.current/);
  assert.match(source, /proofType !== "PHOTO"/);
  assert.match(source, /setProofPhotoDataUrl\(""\);\s*setProofPhotoCapturedAt\(""\);\s*setIsProofPhotoReady\(false\);/);
  assert.match(source, /submissionStartedRef\.current = true/);
  assert.match(source, /Camera unavailable\. Choose a photo from this device or try again\./);
  assert.match(source, /onClick=\{\(\) => startCameraCapture\(\{ replacePhoto: true \}\)\}/);
  assert.match(source, /claimProof\.isResolved[\s\S]*proofType !== "PHOTO"[\s\S]*setIsCameraOpen\(true\)/);
  assert.match(source, /if \(!isOpen \|\| !isCameraOpen \|\| proofType !== "PHOTO"\)/);
});

test("claim proof layout removes method cards and keeps 4:3 camera framing responsive", async () => {
  const source = await readClientSource("src/index.css");

  assert.doesNotMatch(source, /claim-proof-method-(?:options|option|card)/);
  assert.match(source, /\.claim-proof-camera-preview,[\s\S]*?width: min\(100%, 480px, 60vh\)[\s\S]*?max-height: 45vh[\s\S]*?aspect-ratio: 4 \/ 3/);
  assert.match(source, /@supports \(height: 1dvh\)[\s\S]*?60dvh[\s\S]*?45dvh/);
  assert.match(source, /\.claim-proof-photo-preview[\s\S]*object-fit: contain/);
  assert.match(source, /@media \(max-height: 620px\)[\s\S]*\.stub-claim-confirm-modal[\s\S]*max-height: calc\(100dvh - 16px\)/);
  assert.match(source, /@media \(max-width: 520px\)[\s\S]*\.claim-proof-capture-actions[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("family-head photo remains separate from required claim-time proof", async () => {
  const [source, proofResolver] = await Promise.all([
    readClientSource("src/components/stubs/StubClaimConfirmModal.jsx"),
    readClientSource("src/features/stubs/claimProofWorkflow.js"),
  ]);

  assert.match(source, /Registered Family Head Photo/);
  assert.match(source, /For manual identity verification only\./);
  assert.match(source, /proofType: "PHOTO"[\s\S]*proofPhotoDataUrl/);
  assert.doesNotMatch(proofResolver, /family_head_photo/);
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
