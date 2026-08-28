import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const stylesSourcePath = new URL("../src/index.css", import.meta.url);

test("Sync Center keeps shared role-aware layout hooks for both portals", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /className="sync-center-page"/);
  assert.match(source, /className="sync-center-filter-card"/);
  assert.match(source, /data-filter-count=\{isMswdoPortal \? "5" : "4"\}/);
  assert.match(source, /className="sync-center-filter-grid"/);
  assert.match(source, /className="sync-center-toolbar"/);
  assert.match(source, /className="sync-center-tabs-module"/);
  assert.match(source, /className="sync-center-tablist"/);
  assert.match(source, /className="sync-center-tabpanel"/);
  assert.match(source, /className="sync-center-table-scroll"/);
});

test("Sync Center filter CSS balances desktop, medium, and narrow layouts", async () => {
  const styles = await fs.readFile(stylesSourcePath, "utf8");

  assert.match(
    styles,
    /\.sync-center-filter-grid\s*\{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /\.sync-center-filter-grid\[data-filter-count="4"\]\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1180px\)[\s\S]*\.sync-center-filter-grid\[data-filter-count="5"\][\s\S]*repeat\(3, minmax\(0, 1fr\)\)[\s\S]*\.sync-center-filter-grid\[data-filter-count="4"\][\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/,
  );
});

test("Sync Center keeps actions aligned and tabs semantically connected to content", async () => {
  const [source, styles] = await Promise.all([
    fs.readFile(pageSourcePath, "utf8"),
    fs.readFile(stylesSourcePath, "utf8"),
  ]);

  assert.match(source, /aria-label="Search synchronization records"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /style=\{syncCenterTabPanelStyles\}/);
  assert.match(
    styles,
    /\.sync-center-toolbar\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.sync-center-toolbar__search[\s\S]*grid-column: 1 \/ -1[\s\S]*\.sync-center-toolbar__retry[\s\S]*grid-column: 2/,
  );
  assert.match(styles, /\.sync-center-table-scroll\s*\{[\s\S]*overflow-x: auto/);
});
