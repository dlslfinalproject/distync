import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("shared logo retries its local stable source when connectivity returns", async () => {
  const [logo, sidebar, viteConfig] = await Promise.all([
    readSource("../src/components/layout/DistyncLogo.jsx"),
    readSource("../src/components/layout/Sidebar.jsx"),
    readSource("../vite.config.js"),
  ]);

  assert.match(sidebar, /import DistyncLogo from "\.\/DistyncLogo"/);
  assert.match(sidebar, /<DistyncLogo src=\{distyncLogo\}/);
  assert.match(logo, /window\.addEventListener\("online", retryFailedImage\)/);
  assert.match(logo, /<img key=\{retryKey\} src=\{src\}/);
  assert.match(logo, /window\.removeEventListener\("online", retryFailedImage\)/);
  assert.doesNotMatch(logo, /location\.reload|indexedDB|localStorage|sessionStorage/);
  assert.match(sidebar, /distync-logo\.png/);
  assert.match(viteConfig, /\["distync-logo\.png", "distync-logo-cropped\.png"\]/);
  assert.doesNotMatch(logo, /https?:\/\//);
});

test("runtime recovery preserves the existing offline shell and API boundaries", async () => {
  const [logo, viteConfig] = await Promise.all([
    readSource("../src/components/layout/DistyncLogo.jsx"),
    readSource("../vite.config.js"),
  ]);

  assert.match(logo, /src=\{src\}/);
  assert.doesNotMatch(logo, /fetch\(|axios|\/api\//);
  assert.match(viteConfig, /urlPattern: \(\{ url \}\) => url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(viteConfig, /handler: "NetworkOnly"/);
});
