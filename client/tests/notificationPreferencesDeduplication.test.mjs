import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const settingsHelpersSourcePath = new URL(
  "../src/pages/settings/settingsHelpers.js",
  import.meta.url,
);

test("frontend settings helper source defines canonical alias cleanup for duplicate notification rules", async () => {
  const source = await fs.readFile(settingsHelpersSourcePath, "utf8");

  assert.match(source, /DISASTER_EVENT_UPDATE:\s*"DISASTER_EVENT_UPDATED"/);
  assert.match(source, /EVACUEE_ATTENDANCE_UPDATE:\s*"EVACUEE_ATTENDANCE_UPDATED"/);
  assert.match(source, /HOUSEHOLD_VERIFICATION:\s*"HOUSEHOLD_VERIFICATION_UPDATED"/);
  assert.match(source, /DISTRIBUTION_UPDATE:\s*"DISTRIBUTION_COMPLETED"/);
  assert.match(source, /CRITICAL_STOCK:\s*"CRITICAL_INVENTORY_SHORTAGE"/);
  assert.match(source, /DONATION_STOCK_UPDATE:\s*"DONATION_RECEIVED"/);
  assert.match(source, /SYNCHRONIZATION_CONFLICT_ALERT:\s*"SYNC_CONFLICT"/);
  assert.doesNotMatch(source, /LOW_STOCK:\s*"CRITICAL_INVENTORY_SHORTAGE"/);
  assert.doesNotMatch(source, /INVENTORY_INCIDENT:\s*"OPERATIONAL_ANOMALY"/);
  assert.doesNotMatch(source, /SYNC_CONFLICT:\s*"SYNC_FAILURE"/);
  assert.doesNotMatch(source, /SYSTEM_ANOMALY:\s*"SYNC_FAILURE"/);
  assert.match(source, /HIDDEN_NOTIFICATION_RULE_CODES = new Set\(\[/);
  assert.match(source, /"SYSTEM_ALERT"/);
  assert.match(source, /dedupeNotificationSettings = \(\{/);
  assert.match(source, /sortNotificationCategories/);
  assert.match(source, /sortCategoryRules/);
});

test("frontend settings helper source encodes the approved role category counts and order", async () => {
  const source = await fs.readFile(settingsHelpersSourcePath, "utf8");

  assert.match(source, /\[ROLE_CODES\.BARANGAY\]: \{/);
  assert.match(source, /DISASTER_COORDINATION:\s*0/);
  assert.match(source, /EVACUEE_MANAGEMENT:\s*1/);
  assert.match(source, /SYSTEM_OPERATIONS:\s*2/);
  assert.match(source, /\[ROLE_CODES\.MSWDO\]: \{/);
  assert.match(source, /DISASTER_MANAGEMENT:\s*0/);
  assert.match(source, /RELIEF_OPERATIONS:\s*2/);
  assert.match(source, /\[ROLE_CODES\.MAYOR\]: \{/);
  assert.match(source, /DISASTER_MONITORING:\s*0/);
  assert.match(source, /INVENTORY_MONITORING:\s*2/);
  assert.match(source, /SYSTEM_MONITORING:\s*3/);
  assert.match(source, /DISASTER_EVENT_UPDATED:\s*1/);
  assert.match(source, /HOUSEHOLD_REGISTERED:\s*2/);
  assert.match(source, /EVACUEE_ATTENDANCE_UPDATED:\s*3/);
  assert.match(source, /HOUSEHOLD_VERIFICATION_UPDATED:\s*4/);
  assert.match(source, /DISTRIBUTION_COMPLETED:\s*5/);
  assert.match(source, /LOW_STOCK:\s*6/);
  assert.match(source, /CRITICAL_INVENTORY_SHORTAGE:\s*7/);
  assert.match(source, /NEAR_EXPIRY_STOCK:\s*8/);
  assert.match(source, /EXPIRED_STOCK:\s*9/);
  assert.match(source, /INVENTORY_INCIDENT:\s*10/);
  assert.match(source, /DONATION_RECEIVED:\s*11/);
  assert.match(source, /SYNC_FAILURE:\s*12/);
  assert.match(source, /SYNC_CONFLICT:\s*13/);
  assert.match(source, /DONATION_STOCK_ANOMALY:\s*14/);
  assert.match(source, /EVACUATION_SUMMARY_REPORT:\s*15/);
});
