import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const settingsHelpersSourcePath = new URL(
  "../src/pages/settings/settingsHelpers.js",
  import.meta.url,
);
const roleSettingsPageSourcePath = new URL(
  "../src/pages/settings/RoleSettingsPage.jsx",
  import.meta.url,
);
const notificationSectionSourcePath = new URL(
  "../src/pages/settings/components/NotificationPreferencesSection.jsx",
  import.meta.url,
);
const feedbackToastSourcePath = new URL(
  "../src/components/shared/FeedbackToast.jsx",
  import.meta.url,
);

test("notification helper source defines safe user-facing mappings and compact delivery hints", async () => {
  const source = await fs.readFile(settingsHelpersSourcePath, "utf8");

  assert.match(source, /CRITICAL:\s*"Critical alert"/);
  assert.match(source, /WARNING:\s*"Important alert"/);
  assert.match(source, /INFORMATIONAL:\s*"General update"/);
  assert.match(source, /HOURLY_SUMMARY:\s*"Hourly summary"/);
  assert.match(source, /DAILY_SUMMARY:\s*"Daily summary"/);
  assert.match(source, /THRESHOLD:\s*"Sent when a limit is reached"/);
  assert.match(source, /SILENT_UI_FEEDBACK:\s*"Shown in the current screen"/);
  assert.match(source, /labels\[value\] \|\| fallback/);
  assert.match(source, /Grouped into an hourly summary\./);
  assert.match(source, /Grouped into a daily summary\./);
  assert.match(source, /Sent when a limit is reached\./);
  assert.match(source, /Shown in the current screen\./);
  assert.match(source, /return "";/);
  assert.match(source, /JSON\.stringify\(leftPayload\) === JSON\.stringify\(rightPayload\)/);
  assert.match(
    source,
    /return `\$\{count\} notification type\$\{count === 1 \? "" : "s"\}`;/,
  );
  assert.match(source, /Required in-app alerts cannot be disabled\./);
});

test("notification settings page source keeps custom modal flows and hides native dialogs", async () => {
  const source = await fs.readFile(roleSettingsPageSourcePath, "utf8");

  assert.doesNotMatch(source, /window\.confirm\s*\(/);
  assert.doesNotMatch(source, /window\.alert\s*\(/);
  assert.match(source, /<ConfirmationModal/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /Reset notification preferences\?/);
  assert.match(source, /setProfileTouched\(\{/);
});

test("notification preferences section source uses compact aligned category rows", async () => {
  const source = await fs.readFile(notificationSectionSourcePath, "utf8");

  assert.match(source, /Notification Preferences/);
  assert.match(source, /Choose how approved updates appear in DISTYNC and, when available, by/);
  assert.match(source, /Notification types/);
  assert.match(source, /gridTemplateColumns: "minmax\(0, 1fr\) 110px 110px"/);
  assert.match(source, /<p style=\{desktopHeaderLabelStyles\}>Email<\/p>/);
  assert.match(source, /<p style=\{desktopHeaderLabelStyles\}>In-app<\/p>/);
  assert.match(source, /Required<\/span>/);
  assert.match(source, /Not available/);
  assert.match(source, /Changes require an internet connection\./);
  assert.match(source, /Loading notification preferences\.\.\./);
  assert.match(source, /Notification preferences could not be loaded\./);
  assert.match(source, /No notification settings are assigned to this role\./);
  assert.match(source, /window\.innerWidth < MOBILE_BREAKPOINT/);
  assert.match(source, /Email delivery is not available for this notification\./);
  assert.match(source, /This notification is required and cannot be disabled\./);
  assert.doesNotMatch(source, /Critical alert/);
  assert.doesNotMatch(source, /Daily summary<\/span>/);
  assert.doesNotMatch(source, /pillStyles/);
  assert.doesNotMatch(source, /You are offline\. Notification settings are available for viewing,/);
});

test("notification preferences section source no longer uses nested per-rule cards", async () => {
  const source = await fs.readFile(notificationSectionSourcePath, "utf8");

  assert.doesNotMatch(source, /getPriorityTone/);
  assert.doesNotMatch(source, /PRIORITY_LABELS/);
  assert.doesNotMatch(source, /DELIVERY_MODE_LABELS/);
  assert.doesNotMatch(source, /role\.code/);
  assert.match(source, /categorySectionStyles/);
  assert.match(source, /NotificationPreferenceRow/);
  assert.match(source, /NotificationChannelControl/);
});

test("feedback toast source includes live region semantics", async () => {
  const source = await fs.readFile(feedbackToastSourcePath, "utf8");

  assert.match(source, /role=\{type === "error" \? "alert" : "status"\}/);
  assert.match(source, /aria-live=\{type === "error" \? "assertive" : "polite"\}/);
  assert.match(source, /aria-atomic="true"/);
});
