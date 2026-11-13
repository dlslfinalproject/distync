import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("shared DISTYNC shell branding uses one stable offline asset for every staff role", async () => {
  const [layout, sidebar, header, viteConfig] = await Promise.all([
    readSource("../src/components/layout/BarangayLayout.jsx"),
    readSource("../src/components/layout/Sidebar.jsx"),
    readSource("../src/components/layout/ShellHeader.jsx"),
    readSource("../vite.config.js"),
  ]);

  assert.match(layout, /<ShellHeader/);
  assert.match(layout, /<Sidebar/);
  assert.match(sidebar, /ROLE_CODES\.BARANGAY/);
  assert.match(sidebar, /ROLE_CODES\.MSWDO/);
  assert.match(sidebar, /ROLE_CODES\.MAYOR/);
  assert.match(sidebar, /import distyncLogo from "\.\.\/\.\.\/assets\/distync-logo\.png"/);
  assert.match(header, /<SidebarBrandStrip/);
  assert.match(viteConfig, /assetInfo\.name/);
  assert.match(viteConfig, /\["distync-logo\.png", "distync-logo-cropped\.png"\]/);
  assert.match(viteConfig, /`assets\/\$\{assetInfo\.name\}`/);
});
