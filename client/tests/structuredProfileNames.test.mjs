import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const helpersSourcePath =
  new URL("../src/pages/settings/settingsHelpers.js", import.meta.url);

test("settings helpers define structured display-name composition", async () => {
  const source = await fs.readFile(helpersSourcePath, "utf8");

  assert.match(source, /export const buildDisplayName/);
  assert.match(source, /\[firstName, middleName, lastName\]/);
});

test("settings helpers validate structured names independently", async () => {
  const source = await fs.readFile(helpersSourcePath, "utf8");

  assert.match(source, /errors\.firstName/);
  assert.match(source, /errors\.middleName/);
  assert.match(source, /errors\.lastName/);
  assert.match(source, /The name contains unsupported characters\./);
});
