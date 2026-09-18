import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Barangay and MSWDO readiness notifications show only verified Ready", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");
  assert.match(source, /Offline Data Ready/);
  assert.match(source, /if \(!ready\) return null/);
  assert.doesNotMatch(source, /Preparing records for the current disaster event/);
  assert.doesNotMatch(source, /DISTYNC is preparing the information needed for offline use/);
  assert.match(source, /supported offline operations/);
  assert.match(source, /getOfflineReadyIdentity/);
  assert.doesNotMatch(source, /IndexedDB|object store|UUID|cache key/i);
  assert.doesNotMatch(source, /API terminology/i);
  assert.match(source, /previousStatus/);
});

test("Offline Data Ready popup is centered in the current viewport with responsive bounds", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");

  assert.match(source, /position: "fixed"/);
  assert.match(source, /top: "50%"/);
  assert.match(source, /left: "50%"/);
  assert.match(source, /transform: "translate\(-50%, -50%\)"/);
  assert.match(source, /width: "min\(390px, calc\(100vw - 32px\)\)"/);
  assert.match(source, /maxHeight: "calc\(100dvh - 32px\)"/);
  assert.match(source, /overflowY: "auto"/);
  assert.doesNotMatch(source, /const panelStyle = \{[^}]*\bbottom:/s);
  assert.match(source, /Got It/);
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
