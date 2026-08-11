import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "src", "pages", "inventory", "NotificationCenterPage.jsx");
const bellPath = path.join(process.cwd(), "src", "components", "layout", "HeaderNotifications.jsx");
const vitePath = path.join(process.cwd(), "vite.config.js");

test("Notification Center treats offline data as unavailable and blocks server mutations", async () => {
  const source = await fs.readFile(pagePath, "utf8");

  assert.match(source, /You're offline\. Notifications are unavailable until you reconnect\./);
  assert.match(source, /disabled: isRefreshing \|\| !isOnline \|\| !sessionScope/);
  assert.match(source, /disabled: !unreadCount \|\| isMarkingAllRead \|\| !isOnline \|\| !sessionScope/);
  assert.match(source, /if \(!isOnline \|\| !sessionScope\)/);
  assert.match(source, /isOnline && nextCursor/);
  assert.match(source, /Unread: \{isOnline \? unreadCount : "Unavailable"\}/);
});

test("Notification state is owned by access mode, user, and role", async () => {
  const [page, bell] = await Promise.all([
    fs.readFile(pagePath, "utf8"),
    fs.readFile(bellPath, "utf8"),
  ]);

  for (const source of [page, bell]) {
    assert.match(source, /\$\{accessMode\}:\$\{authenticatedUser\.id\}:\$\{currentRole\}/);
    assert.match(source, /sessionScopeRef\.current|notificationScopeRef\.current/);
  }

  assert.match(page, /setNotifications\(\[\]\); setNextCursor\(null\)/);
  assert.match(page, /setSelectedNotification\(null\)/);
  assert.match(bell, /setRecentNotifications\(\[\]\)/);
});

test("Authenticated notification APIs remain network-only in the service worker", async () => {
  const source = await fs.readFile(vitePath, "utf8");
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /handler: "NetworkOnly"/);
});
