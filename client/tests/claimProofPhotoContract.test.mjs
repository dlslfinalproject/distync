import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readClientSource = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Barangay claim confirmation captures a new camera photo, previews it, and requires explicit confirmation", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /Photo Proof/);
  assert.match(source, /setProofType\("PHOTO"\);[\s\S]*Photo Proof/);
  assert.doesNotMatch(source, /setProofType\("PHOTO"\)[\s\S]{0,160}qrReferenceValue/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /Capture Photo/);
  assert.match(source, /alt="Claim handoff proof preview"/);
  assert.match(source, /Use Photo/);
  assert.match(source, /Retake Photo/);
  assert.match(source, /normalizeImageDrawableToDataUrl\([\s\S]*?maxDimension: 1600[\s\S]*?maxOutputBytes: 2 \* 1024 \* 1024/);
  assert.match(source, /isProofPhotoReady/);
  assert.match(source, /onConfirm\?\.\(\{\s*proofType: "PHOTO"/);
  assert.match(source, /disabled=\{isSubmitting \|\| isLoadingStubDetails \|\| \(selectedCount === 1/);
  assert.doesNotMatch(source, /<input[^>]+type=["']file["']/i);
});

test("camera cancellation and method changes discard pending photo and stop tracks", async () => {
  const source = await readClientSource("src/components/stubs/StubClaimConfirmModal.jsx");

  assert.match(source, /if \(!isOpen\)\s*\{[\s\S]*?captureRequestRef\.current \+= 1;[\s\S]*?setProofPhotoDataUrl\(""\);/);
  assert.match(source, /stream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /if \(cancelled\) \{\s*stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /requestId !== captureRequestRef\.current/);
  assert.match(source, /proofType !== "PHOTO"/);
  assert.match(source, /setProofType\("QR"\);\s*setProofPhotoDataUrl\(""\);/);
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
