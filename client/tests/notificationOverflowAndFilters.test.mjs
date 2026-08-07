import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(
  process.cwd(),
  "src",
  "pages",
  "inventory",
  "MayorNotificationsPage.jsx",
);

test("notification overflow is isolated from read mutation", async () => {
  const source = await fs.readFile(pagePath, "utf8");

  assert.match(source, /aria-label="More actions"/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /event\.stopPropagation\(\); setOpenOverflowId/);
  assert.match(source, /role="menuitem"[\s\S]*?Mark as read/);
  assert.match(source, /const hasSecondaryAction = !notification\.read_at/);
  assert.doesNotMatch(source, /Mark as unread/);
});

test("notification filters use draft apply controls and removable chips", async () => {
  const source = await fs.readFile(pagePath, "utf8");

  assert.match(source, /aria-label="Notification filters"/);
  assert.match(source, /Apply filters/);
  assert.match(source, /Category: \{filters\.category\}/);
  assert.match(source, /Priority: \{filters\.priority/);
  assert.match(source, /Filter \(\$\{activeFilterCount\}\)/);
  assert.match(source, /gap: activeFilterCount \? 12 : 0/);
  assert.match(source, /activeFilterCount \? <div/);
});
