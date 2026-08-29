import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("readiness popup preserves operational states and avoids technical copy", async () => {
  const source = await read("components/layout/OfflineDataReadiness.jsx");
  assert.match(source, /Preparing Offline Data/);
  assert.match(source, /Offline Data Ready/);
  assert.match(source, /Offline Data Not Ready/);
  assert.match(source, /Offline Data Needs Refresh/);
  assert.match(source, /supported offline operations/);
  assert.match(source, /previous/);
  assert.doesNotMatch(source, /IndexedDB|object store|UUID|cache key/i);
});
