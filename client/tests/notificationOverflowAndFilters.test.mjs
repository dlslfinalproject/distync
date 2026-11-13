import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(
  process.cwd(),
  "src",
  "pages",
  "inventory",
  "NotificationCenterPage.jsx",
);

test("notification overflow is isolated from read mutation", async () => {
  const source = await fs.readFile(pagePath, "utf8");

  assert.match(source, /TableActionsMenu/);
  assert.match(source, /buttonAriaLabel=\{`More actions for \$\{view\.title\}`\}/);
  assert.match(source, /dataPrefix="notification-actions"/);
  assert.match(source, /label: "Mark as read"/);
  assert.match(source, /const hasSecondaryAction = view\.unread/);
  assert.match(source, /className="notification-primary-action"/);
  assert.doesNotMatch(source, /Mark as unread/);
});

test("notification filters use draft apply controls and removable chips", async () => {
  const source = await fs.readFile(pagePath, "utf8");

  assert.match(source, /title="Notification filters"/);
  assert.match(source, /ResponsiveFilterPopover/);
  assert.match(source, /Apply filters/);
  assert.match(source, /Clear/);
  assert.match(source, /Category: \{getNotificationCategoryLabel\(\{ category_code: filters\.category \}\)\}/);
  assert.match(source, /Priority: \{filters\.priority === "INFO" \? "Informational" : filters\.priority\}/);
  assert.match(source, /Filter \(\$\{activeFilterCount\}\)/);
  assert.match(source, /gap: activeFilterCount \? 12 : 0/);
  assert.match(source, /activeFilterCount \? <div/);
});
