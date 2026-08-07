import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "src", "pages", "inventory", "MayorNotificationsPage.jsx");
const servicePath = path.join(process.cwd(), "src", "features", "notifications", "notificationService.js");

test("Notification Center sends active filters to the server and appends cursor pages", async () => {
  const [pageSource, serviceSource] = await Promise.all([
    fs.readFile(pagePath, "utf8"),
    fs.readFile(servicePath, "utf8"),
  ]);

  assert.match(pageSource, /category: filters\.category/);
  assert.match(pageSource, /priority: filters\.priority/);
  assert.match(pageSource, /cursor,/);
  assert.match(pageSource, /Load more/);
  assert.match(pageSource, /append: true, cursor: nextCursor/);
  assert.doesNotMatch(pageSource, /const filtered = useMemo/);
  assert.match(serviceSource, /searchParams\.set\("cursor", cursor\)/);
});
