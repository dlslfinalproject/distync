import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readSource = (relativePath) =>
  readFile(resolve(projectRoot, relativePath), "utf8");

test("MSWDO disaster event lists use the list response without detail fan-out", async () => {
  const source = await readSource(
    "src/features/disaster-events/useDisasterEvents.js",
  );
  const loadEventsStart = source.indexOf("const loadEvents = async");
  const loadBarangaysStart = source.indexOf("const loadBarangays = async");
  const loadEventsSource = source.slice(loadEventsStart, loadBarangaysStart);

  assert.notEqual(loadEventsStart, -1);
  assert.notEqual(loadBarangaysStart, -1);
  assert.doesNotMatch(loadEventsSource, /fetchDisasterEventById|Promise\.all/);
  assert.match(loadEventsSource, /setEvents\(Array\.isArray\(eventRows\)/);
  assert.match(source, /const openEditModal = async[\s\S]*fetchDisasterEventById/);
});

test("Disaster Event export scope also uses affected barangays from the list response", async () => {
  const source = await readSource("src/pages/mswdo/DisasterEventsPage.jsx");
  const effectStart = source.indexOf("const loadExportScopeEvents = async");
  const effectEnd = source.indexOf("    loadExportScopeEvents();", effectStart);
  const effectSource = source.slice(effectStart, effectEnd);

  assert.notEqual(effectStart, -1);
  assert.notEqual(effectEnd, -1);
  assert.doesNotMatch(effectSource, /fetchDisasterEventById|Promise\.all|detailedRows/);
  assert.match(effectSource, /setExportScopeEvents\(Array\.isArray\(eventRows\)/);
});
