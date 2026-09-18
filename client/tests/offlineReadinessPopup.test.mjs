import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
const readCss = () => readFile(new URL("../src/index.css", import.meta.url), "utf8");

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

test("expanded Offline Data Ready popup is mobile-centered and desktop-right", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");
  const css = await readCss();

  assert.match(source, /position: "fixed"/);
  assert.match(source, /left: "var\(--offline-ready-left, 50%\)"/);
  assert.match(source, /bottom: "max\(16px, env\(safe-area-inset-bottom\)\)"/g);
  assert.match(source, /transform: "var\(--offline-ready-transform, translateX\(-50%\)\)"/);
  assert.doesNotMatch(source, /top: "50%"/);
  assert.doesNotMatch(source, /translate\(-50%, -50%\)/);
  assert.match(source, /right: "var\(--offline-ready-right, auto\)"/);
  assert.match(css, /@media \(min-width: 1025px\)[\s\S]*?\.offline-data-readiness-panel[\s\S]*?--offline-ready-left: auto;[\s\S]*?--offline-ready-right: max\(16px, env\(safe-area-inset-right\)\);[\s\S]*?--offline-ready-transform: none;/);
  assert.match(source, /width: "min\(390px, calc\(100vw - 32px\)\)"/);
  assert.match(source, /maxHeight: "calc\(100dvh - 32px - env\(safe-area-inset-bottom\)\)"/);
  assert.match(source, /overflowY: "auto"/);
  assert.match(source, /Got It/);
});

test("acknowledged Offline Data Ready badge is fixed, bottom-right, and not centered", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");

  assert.ok(source.includes('const compactBadgeStyle = { ...buttonStyle, position: "fixed", right: "max(16px, env(safe-area-inset-right))", bottom: "max(16px, env(safe-area-inset-bottom))"'));
  assert.doesNotMatch(source, /const compactBadgeStyle = \{[^}]*left:/s);
  assert.doesNotMatch(source, /const compactBadgeStyle = \{[^}]*transform:/s);
  assert.match(source, /if \(!readyNotice \|\| readyAcknowledged\)[\s\S]*style=\{compactBadgeStyle\}/);
  assert.match(source, /Offline Data Ready/);
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
