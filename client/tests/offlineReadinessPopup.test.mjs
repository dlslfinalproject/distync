import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Barangay and MSWDO readiness notifications show only verified Ready", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");
  assert.match(source, /Offline Data Ready/);
  assert.match(source, /const isBarangayOrMswdo = variant === "barangay" \|\| variant === "mswdo"/);
  assert.match(source, /if \(isBarangayOrMswdo && !ready\) return null/);
  assert.doesNotMatch(source, /Preparing records for the current disaster event/);
  assert.doesNotMatch(source, /DISTYNC is preparing the information needed for offline use/);
  assert.match(source, /supported offline operations/);
  assert.match(source, /previous/);
  assert.doesNotMatch(source, /IndexedDB|object store|UUID|cache key/i);
  assert.doesNotMatch(source, /API terminology/i);
  assert.match(source, /previousStatus/);
});

test("preparation publishes sanitized diagnostics and verifies read-back before READY", async () => {
  const source = await read("offline/offlinePreparation.js");
  assert.match(source, /distync-offline-preparation-updated/);
  assert.match(source, /readBack: true/);
  assert.match(source, /!masterlistReadBack/);
  assert.doesNotMatch(source, /masterlistReadBackSucceeded/);
  assert.match(source, /recordsByPage/);
  assert.match(source, /previousCompleteCache/);
  assert.doesNotMatch(source, /publishDiagnostics\(\{[^}]*pageRows/);
});
