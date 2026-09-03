import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = path.join(
  process.cwd(),
  "src",
  "components",
  "donations",
  "DonorTransparencyTab.jsx",
);

test("Mayor donation transparency renders every movement with its inventory unit", async () => {
  const source = await fs.readFile(sourcePath, "utf8");

  assert.match(source, /const formatQuantityWithUnit =/);
  assert.match(source, /row\.quantity_received,[\s\S]*row\.unit_of_measure/);
  assert.match(source, /row\.quantity_distributed,[\s\S]*row\.unit_of_measure/);
  assert.match(source, /row\.quantity_written_off,[\s\S]*row\.unit_of_measure/);
  assert.match(source, /row\.quantity_remaining,[\s\S]*row\.unit_of_measure/);
});
