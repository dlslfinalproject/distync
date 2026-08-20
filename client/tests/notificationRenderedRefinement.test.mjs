import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  getNotificationCategoryLabel,
  toNotificationViewModel,
} from "../src/features/notifications/notificationPresentation.js";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

test("notification category filter labels are meaningful and preserve values", () => {
  const categories = [
    "SYSTEM_OPERATIONS",
    "SYSTEM_MONITORING",
    "DISASTER_COORDINATION",
    "DISASTER_MANAGEMENT",
    "DISASTER_MONITORING",
    "RELIEF_OPERATIONS",
    "INVENTORY_MONITORING",
    "EVACUEE_MANAGEMENT",
  ];
  const labels = categories.map((category) =>
    getNotificationCategoryLabel({ category_code: category }),
  );

  assert.deepEqual(labels, [
    "System Operations",
    "System Monitoring",
    "Disaster Coordination",
    "Disaster Management",
    "Disaster Monitoring",
    "Relief Operations",
    "Inventory Monitoring",
    "Evacuee Management",
  ]);
  assert.equal(new Set(labels).size, labels.length);
  assert.doesNotMatch(labels.join(" "), /SYSTEM_OPERATIONS|SYSTEM_MONITORING/);
});

test("notification cards keep operational actions visible and remove redundant card type", async () => {
  const pageSource = await fs.readFile(
    sourcePath("pages", "inventory", "NotificationCenterPage.jsx"),
    "utf8",
  );

  assert.match(pageSource, /className="notification-primary-action"/);
  assert.match(pageSource, /TableActionsMenu/);
  assert.match(pageSource, /label: "Mark as read"/);
  assert.doesNotMatch(pageSource, /\{view\.typeLabel\}<\/span><\/div><h3/);

  const view = toNotificationViewModel({
    id: "notification-1",
    type: "EVENT",
    title: "Disaster event update",
    message: "DE-2026-0005 Typhoon Luis Response was ended.",
    category_code: "DISASTER_COORDINATION",
    severity: "CRITICAL",
    generated_at: "2026-08-19T01:52:00.000Z",
  });

  assert.equal(view.categoryLabel, "Disaster Coordination");
  assert.equal(view.typeLabel, "Event");
  assert.match(view.message, /DE-2026-0005/);
});

test("notification responsive CSS reduces nested spacing and stacks mobile actions", async () => {
  const cssSource = await fs.readFile(sourcePath("index.css"), "utf8");

  assert.match(cssSource, /\.notifications-list-card \{/);
  assert.match(cssSource, /\.notification-message \{[\s\S]*?max-width: 68ch;/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*?\.notification-action-row \{[\s\S]*?width: calc\(100% - 21px\);/);
  assert.match(cssSource, /@media \(max-width: 430px\)[\s\S]*?\.notifications-list-card \{[\s\S]*?padding: 10px !important;/);
  assert.match(cssSource, /\.notification-primary-action \{[\s\S]*?width: 100%;/);
  assert.doesNotMatch(cssSource, /notification[\s\S]*?flex-wrap:\s*nowrap/);
});
