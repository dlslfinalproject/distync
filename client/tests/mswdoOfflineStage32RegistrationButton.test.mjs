import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = () => readFile(
  new URL("../src/components/mswdo-masterlist/MswdoMasterlistControls.jsx", import.meta.url),
  "utf8",
);

test("MSWDO Register Family remains clickable offline", async () => {
  const source = await read();
  const registerStart = source.indexOf("Register Family");
  const registerButtonSource = source.slice(source.lastIndexOf("<button", registerStart), registerStart);

  assert.match(registerButtonSource, /onClick=\{onOpenRegisterModal\}/);
  assert.doesNotMatch(registerButtonSource, /disabled=\{isOffline\}/);
});

test("MSWDO export remains disabled offline independently of registration", async () => {
  const source = await read();
  assert.match(source, /disabled=\{isOffline \|\| !selectedDisasterEventId \|\| Boolean\(exportingFormat\)\}/);
});
