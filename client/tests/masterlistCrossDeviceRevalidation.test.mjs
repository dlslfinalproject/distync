import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const readSource = (...segments) =>
  fs.readFile(path.join(testDirectory, "..", ...segments), "utf8");

test("Barangay Masterlist revalidates remotely while visible and online", async () => {
  const source = await readSource(
    "src",
    "features",
    "masterlist",
    "useBarangayMasterlistSync.js",
  );

  assert.match(source, /REMOTE_MASTERLIST_REVALIDATION_INTERVAL_MS = 60 \* 1000/);
  assert.match(source, /window\.setInterval\(\s*revalidate/);
  assert.match(source, /window\.addEventListener\("online", revalidate\)/);
  assert.match(source, /window\.addEventListener\("focus", revalidate\)/);
  assert.match(source, /visibilityState !== "hidden"/);
  assert.match(source, /window\.clearInterval\(intervalId\)/);
  assert.match(source, /removeEventListener\("visibilitychange", revalidate\)/);
});

