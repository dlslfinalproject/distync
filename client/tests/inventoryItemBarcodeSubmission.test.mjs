import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const formSourcePath = path.join(
  process.cwd(),
  "src",
  "components",
  "inventory-items",
  "InventoryItemFormModal.jsx",
);

test("Add Item barcode entry does not submit when a scanner sends Enter", async () => {
  const source = await fs.readFile(formSourcePath, "utf8");

  assert.match(
    source,
    /const preventBarcodeScanSubmit = \(event\) => \{\s*if \(event\.key === "Enter"\) \{\s*event\.preventDefault\(\);\s*\}\s*\};/,
  );

  const barcodeFieldStart = source.indexOf('id="barcode"');
  assert.notEqual(barcodeFieldStart, -1);

  const barcodeFieldEnd = source.indexOf(
    'aria-invalid={Boolean(visibleFieldErrors.barcode)}',
    barcodeFieldStart,
  );
  assert.notEqual(barcodeFieldEnd, -1);

  const barcodeFieldSource = source.slice(barcodeFieldStart, barcodeFieldEnd);
  assert.match(barcodeFieldSource, /onKeyDown=\{preventBarcodeScanSubmit\}/);
});

test("registered Add Item barcodes resolve into the pre-filled restock flow", async () => {
  const source = await fs.readFile(formSourcePath, "utf8");

  assert.match(source, /findMayorInventoryItemByBarcode\(/);
  assert.match(
    source,
    /const barcodeMatchedItem = barcodeMatchedExistingItem\?\.item \|\| null;/,
  );
  assert.match(
    source,
    /const isRestockMode = mode === "create" && Boolean\(matchedExistingItem\);/,
  );
  assert.match(
    source,
    /item_name: matchedExistingItem\.item_name \|\| prev\.item_name/,
  );
  assert.match(
    source,
    /selectedStockForm\?\.packaging \|\| matchedExistingItem\.packaging/,
  );
  assert.match(
    source,
    /existing_item_id: matchedExistingItem\?\.id \|\| null/,
  );
  assert.match(source, /: "Restock Existing Item"/);
});

test("Add Item delays required validation but keeps immediate numeric validation", async () => {
  const source = await fs.readFile(formSourcePath, "utf8");

  assert.match(
    source,
    /const \[hasAttemptedSubmit, setHasAttemptedSubmit\] = useState\(false\);/,
  );
  assert.match(source, /const IMMEDIATE_VALIDATION_FIELDS = new Set\(/);
  assert.match(source, /const getImmediateNumericFieldError = \(fieldName, value\) =>/);
  assert.match(source, /fieldName === "packaging_count"/);
  assert.match(source, /const visibleFieldErrors = Object\.fromEntries\(/);
  assert.match(
    source,
    /hasAttemptedSubmit \|\| isImmediateValidationField\(fieldName\)/,
  );
  assert.match(source, /setHasAttemptedSubmit\(true\)/);
  assert.match(source, /aria-invalid=\{Boolean\(visibleFieldErrors\.packaging_count\)\}/);
});
