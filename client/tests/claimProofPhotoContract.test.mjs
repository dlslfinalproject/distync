import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { CLAIM_INITIATION_SOURCE, resolveClaimProof } from "../src/features/stubs/claimProofWorkflow.js";

const readClientSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("claim proof requires a verified scan or explicit unavailable-Stub context", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");
  const activeQrStub = {
    id: "stub-1",
    qr_code_value: "qr-1",
    qr_status: "ACTIVE",
  };
  const [physicalScan, lostStub, implicitRowClaim, mismatchedScan, inactiveScan, scanWithoutReference, loadingProof] = [
    resolveClaimProof({
      stubDetails: activeQrStub,
      claimInitiationSource: CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN,
      qrReferenceValue: "qr-1",
    }),
    resolveClaimProof({
      stubDetails: activeQrStub,
      claimInitiationSource: CLAIM_INITIATION_SOURCE.STUB_UNAVAILABLE,
    }),
    resolveClaimProof({ stubDetails: activeQrStub }),
    resolveClaimProof({
      stubDetails: activeQrStub,
      claimInitiationSource: CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN,
      qrReferenceValue: "different-qr",
    }),
    resolveClaimProof({
      stubDetails: { ...activeQrStub, qr_status: "INACTIVE" },
      claimInitiationSource: CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN,
      qrReferenceValue: "qr-1",
    }),
    resolveClaimProof({
      stubDetails: activeQrStub,
      claimInitiationSource: CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN,
    }),
    resolveClaimProof({
      stubDetails: null,
      claimInitiationSource: CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN,
      isLoadingStubDetails: true,
    }),
  ];

  assert.equal(physicalScan.proofType, "QR");
  assert.equal(physicalScan.qrReferenceValue, "qr-1");
  assert.equal(lostStub.proofType, "PHOTO");
  assert.equal(lostStub.qrReferenceValue, "");
  assert.equal(implicitRowClaim.isResolved, false);
  assert.equal(implicitRowClaim.proofType, "");
  assert.equal(mismatchedScan.isResolved, false);
  assert.equal(mismatchedScan.proofType, "");
  assert.equal(inactiveScan.isResolved, false);
  assert.equal(scanWithoutReference.isResolved, false);
  assert.equal(loadingProof.proofType, "");

  assert.match(source, /resolveClaimProof\(/);
  assert.match(source, /claimInitiationSource,/);
  assert.doesNotMatch(source, /allowPhotoProof/);
  assert.match(source, /Photo Proof of Receipt/);
  assert.doesNotMatch(source, /Choose proof method/);
  assert.doesNotMatch(source, /type="radio"/);
  assert.doesNotMatch(source, /setProofType/);
  assert.match(source, /<QrCodePanel[\s\S]*?value=\{resolvedQrReferenceValue\}/);
  assert.match(source, /proofType === "QR" && resolvedQrReferenceValue/);
  assert.match(source, /proofPhotoDataUrl: ""/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /Physical Stub Unavailable/);
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
test("single Stub confirmation always shows Photo Proof status below beneficiary details", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /Photo Proof of Receipt/);
  assert.match(source, /Proof requirements follow the claim path/);
  assert.match(source, /Not Required — Stub QR Verified/);
  assert.match(source, /Physical Stub QR Verified\.[\s\S]*physical Stub QR was successfully verified\.[\s\S]*Photo Proof is\s*required only when the physical Stub is unavailable\./);
  assert.match(source, /aria-labelledby="claim-proof-section-title"/);

  const workflowPosition = source.indexOf("claim-proof-workflow--");
  const beneficiaryPosition = source.indexOf('className="stub-claim-confirm-content"');
  const footerPosition = source.indexOf('className="stub-claim-confirm-actions"');
  assert.ok(workflowPosition > beneficiaryPosition);
  assert.ok(workflowPosition < footerPosition);

  const qrStateStart = source.indexOf('{proofType === "QR" ? (', workflowPosition);
  const photoStateStart = source.indexOf(': proofType === "PHOTO" ? (', qrStateStart);
  assert.ok(qrStateStart > workflowPosition);
  assert.ok(photoStateStart > qrStateStart);
  const qrStateMarkup = source.slice(qrStateStart, photoStateStart);
  assert.doesNotMatch(qrStateMarkup, /Capture Photo|Take Photo|Choose from Device|claim-proof-file-input|<video/);
  assert.match(source, /proofType === "PHOTO" \? \([\s\S]*?claim-proof-capture/);
});

test("unavailable-Stub copy is concise and shared by Barangay and MSWDO", async () => {
  const [claimSource, barangaySource, mswdoSource] = await Promise.all([
    readClientSource("src/components/stubs/StubClaimConfirmModal.jsx"),
    readClientSource("src/pages/barangay/StubDistributionPage.jsx"),
    readClientSource("src/pages/mswdo/StubDistributionPage.jsx"),
  ]);

  assert.match(
    claimSource,
    /<strong>Physical Stub Unavailable\.<\/strong>\s*Verify the household,\s*then capture a photo of the relief handover\./,
  );
  assert.doesNotMatch(claimSource, /The claimant cannot present a usable issued Stub/);
  assert.match(barangaySource, /<StubClaimConfirmModal/);
  assert.match(mswdoSource, /<StubClaimConfirmModal/);
});

test("Claim Receipt Proof viewer uses an accessible X close control", async () => {
  const source = await readClientSource("src/components/distribution/ClaimProofPhotoModal.jsx");

  assert.match(source, /import \{ FiX \} from "react-icons\/fi"/);
  assert.match(source, /aria-label="Close claim receipt proof"/);
  assert.match(source, /title="Close"/);
  assert.match(source, /width: "44px"/);
  assert.match(source, /height: "44px"/);
  assert.match(source, /<FiX size=\{20\} aria-hidden="true" \/>/);
  assert.doesNotMatch(source, /aria-label="Close claim receipt proof">\s*Close\s*<\/button>/);
});

test("Barangay confirmation uses the shared automatic proof workflow", async () => {
  const [stubPage, transactionPage] = await Promise.all([
    readClientSource("src/pages/barangay/StubDistributionPage.jsx"),
    readClientSource("src/pages/barangay/DistributionTransactionPage.jsx"),
  ]);

  for (const source of [stubPage, transactionPage]) {
    assert.match(source, /import StubClaimConfirmModal/);
    assert.match(source, /<StubClaimConfirmModal[\s\S]*?onConfirm=/);
  }
});

test("MSWDO row confirmation uses the shared automatic proof workflow", async () => {
  const source = await readClientSource("src/pages/mswdo/StubDistributionPage.jsx");

  assert.match(source, /const handleOpenClaimConfirmation = \(stubId\) =>/);
  assert.match(source, /setPendingClaimStubId\(stubId\)/);
  assert.match(source, /setPendingClaimInitiationSource\(CLAIM_INITIATION_SOURCE\.STUB_UNAVAILABLE\)/);
  assert.match(source, /fetchStubDetails\(pendingClaimStubId\)/);
  assert.match(source, /<StubClaimConfirmModal[\s\S]*?stubDetails=\{pendingClaimStubDetails\}/);
  assert.doesNotMatch(source, /allowPhotoProof|must start with a verified QR scan/);
});


test("Barangay and MSWDO row actions explicitly identify the unavailable-Stub fallback", async () => {
  const [barangayTable, mswdoTable] = await Promise.all([
    readClientSource("src/components/stubs/StubResultsTable.jsx"),
    readClientSource("src/components/stubs/MswdoStubResultsTable.jsx"),
  ]);

  for (const source of [barangayTable, mswdoTable]) {
    assert.match(source, /Claim Without Stub/);
    assert.match(source, /usable physical Stub/);
    assert.match(source, /aria-label=/);
    assert.match(source, /title=/);
  }
});

test("both role pages keep QR scan and row fallback as separate initiation paths", async () => {
  const [barangayPage, mswdoPage] = await Promise.all([
    readClientSource("src/pages/barangay/StubDistributionPage.jsx"),
    readClientSource("src/pages/mswdo/StubDistributionPage.jsx"),
  ]);

  for (const source of [barangayPage, mswdoPage]) {
    assert.match(source, /Scan QR on the claimant's physical Stub/);
    assert.match(source, /setPendingClaimInitiationSource\(CLAIM_INITIATION_SOURCE\.STUB_UNAVAILABLE\)/);
    assert.match(source, /setPendingClaimInitiationSource\(CLAIM_INITIATION_SOURCE\.VERIFIED_QR_SCAN\)/);
    assert.match(source, /claimInitiationSource=\{pendingClaimInitiationSource\}/);
    assert.match(source, /proof\.proofType !== expectedProofType/);
    const scanStart = source.indexOf("const handleScannedQr");
    const scanEnd = source.indexOf("return (", scanStart);
    const scanHandler = source.slice(scanStart, scanEnd);
    assert.doesNotMatch(scanHandler, /setPendingClaimInitiationSource\(CLAIM_INITIATION_SOURCE\.STUB_UNAVAILABLE\)/);
  }
});

test("standalone Barangay validation distinguishes camera scan from manual lookup", async () => {
  const [page, verifyPage] = await Promise.all([
    readClientSource("src/pages/barangay/DistributionTransactionPage.jsx"),
    readClientSource("src/pages/VerifyStubPage.jsx"),
  ]);

  assert.match(page, /isPhysicalScan: true/);
  assert.match(page, /setClaimInitiationSource\(CLAIM_INITIATION_SOURCE\.VERIFIED_QR_SCAN\)/);
  assert.match(page, /setIsClaimWithoutStubAvailable\(!isPhysicalScan\)/);
  assert.match(page, /Boolean\(claimInitiationSource\)/);
  assert.match(page, /Claim Without Stub/);
  assert.match(page, /claimInitiationSource=\{claimInitiationSource\}/);
  assert.match(verifyPage, /claimInitiationSource: CLAIM_INITIATION_SOURCE\.VERIFIED_QR_SCAN/);
  assert.match(verifyPage, /qrReferenceValue: qrValue/);
  assert.match(verifyPage, /isVerifiedQrClaimable/);
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
