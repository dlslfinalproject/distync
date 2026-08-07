import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(process.cwd(), "src", "pages", "inventory", "MayorNotificationsPage.jsx");
const modalPath = path.join(process.cwd(), "src", "components", "shared", "FormModalShell.jsx");

test("Notification detail drawer uses the shared accessible modal pattern", async () => {
  const [page, modal] = await Promise.all([fs.readFile(pagePath, "utf8"), fs.readFile(modalPath, "utf8")]);
  assert.match(page, /FormModalShell/);
  assert.match(page, /closeButtonLabel="Close notification details"/);
  assert.match(page, /finalFocusRef=\{detailTriggerRef\.current\?\.isConnected \? detailTriggerRef : fallbackFocusRef\}/);
  assert.match(page, /overflowWrap: "anywhere"/);
  assert.match(page, /<time dateTime=\{notification\.generated_at\}>/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.shiftKey/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
});

test("Notification Center guards pending mutations and stale list responses", async () => {
  const page = await fs.readFile(pagePath, "utf8");
  assert.match(page, /pendingReadIdsRef\.current\.has\(notification\.id\)/);
  assert.match(page, /pendingPrimaryIdsRef\.current\.has\(notification\.id\)/);
  assert.match(page, /isMarkingAllReadRef\.current\) return/);
  assert.match(page, /setPendingReadIds\(\(ids\) => new Set\(ids\)\.add\(notification\.id\)\)/);
  assert.match(page, /isLoadingMoreRef\.current/);
  assert.match(page, /isRefreshingRef\.current/);
  assert.match(page, /requestGeneration !== requestGenerationRef\.current/);
  assert.match(page, /disabled=\{isLoadingMore\}/);
  assert.match(page, /disabled: isRefreshing/);
  assert.match(page, /setNextCursor\(null\)/);
});
