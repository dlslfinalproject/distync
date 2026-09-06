import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(
  resolve(
    testDirectory,
    "../src/components/relief-pack-templates/ReliefPackTemplateFormModal.jsx",
  ),
  "utf8",
);

test("relief pack template name input exposes the shared 150-character limit", () => {
  assert.match(formSource, /RELIEF_PACK_TEMPLATE_NAME_MAX_LENGTH/);
  assert.match(formSource, /maxLength=\{RELIEF_PACK_TEMPLATE_NAME_MAX_LENGTH\}/);
});
