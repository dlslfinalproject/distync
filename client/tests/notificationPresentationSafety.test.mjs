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
const bellPath = path.join(
  process.cwd(),
  "src",
  "components",
  "layout",
  "HeaderNotifications.jsx",
);
const presentationPath = path.join(
  process.cwd(),
  "src",
  "features",
  "notifications",
  "notificationPresentation.js",
);

test("notification UI renders through the allowlisted presentation model", async () => {
  const [page, bell] = await Promise.all([
    fs.readFile(pagePath, "utf8"),
    fs.readFile(bellPath, "utf8"),
  ]);

  assert.match(page, /toNotificationViewModel\(notification\)/);
  assert.match(bell, /toNotificationViewModel\(notification\)/);
  assert.doesNotMatch(page, /JSON\.stringify\(notification/);
  assert.doesNotMatch(page, /Object\.entries\(notification/);
  assert.doesNotMatch(page, /Object\.entries\(notification\.metadata/);
  assert.doesNotMatch(page, /notification\.ruleCode/);
  assert.doesNotMatch(page, /notification\.reference_id/);
  assert.doesNotMatch(page, /notification\.recipient_id/);
});

test("notification presentation hides internal codes while preserving safe context", async () => {
  const source = await fs.readFile(presentationPath, "utf8");

  assert.match(source, /toNotificationViewModel/);
  assert.match(source, /categoryLabel: getNotificationCategoryLabel\(notification\)/);
  assert.doesNotMatch(source, /label: "Rule"/);
  assert.doesNotMatch(source, /notification\.ruleCode/);
  assert.doesNotMatch(source, /notification\?\.reference_type && notification\?\.reference_id/);
  assert.match(source, /label: "Context"/);
  assert.match(source, /humanizeCode\(notification\.reference_type/);
});
