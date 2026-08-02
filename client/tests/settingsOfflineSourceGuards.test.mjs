import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const syncBannerSourcePath = new URL(
  "../src/components/layout/SyncStatusBanner.jsx",
  import.meta.url,
);
const settingsPageSourcePath = new URL(
  "../src/pages/settings/RoleSettingsPage.jsx",
  import.meta.url,
);
const profileSectionSourcePath = new URL(
  "../src/pages/settings/components/ProfileSection.jsx",
  import.meta.url,
);
const notificationSectionSourcePath = new URL(
  "../src/pages/settings/components/NotificationPreferencesSection.jsx",
  import.meta.url,
);
const systemSectionSourcePath = new URL(
  "../src/pages/settings/components/SyncPreferencesSection.jsx",
  import.meta.url,
);
const roleShellSourcePath = new URL(
  "../src/pages/settings/components/RoleSettingsViewShell.jsx",
  import.meta.url,
);
const offlineHelpersSourcePath = new URL(
  "../src/pages/settings/settingsOfflineHelpers.js",
  import.meta.url,
);

test("settings route suppresses the global sync banner", async () => {
  const source = await fs.readFile(syncBannerSourcePath, "utf8");

  assert.match(source, /location\.pathname\.endsWith\("\/settings"\)/);
});

test("settings page and sections contain the dedicated offline messaging", async () => {
  const settingsSource = await fs.readFile(settingsPageSourcePath, "utf8");
  const profileSource = await fs.readFile(profileSectionSourcePath, "utf8");
  const notificationSource = await fs.readFile(
    notificationSectionSourcePath,
    "utf8",
  );
  const systemSource = await fs.readFile(systemSectionSourcePath, "utf8");
  const offlineHelpersSource = await fs.readFile(offlineHelpersSourcePath, "utf8");

  assert.match(
    offlineHelpersSource,
    /Account settings are available for viewing\. Connect to the internet to make changes\./,
  );
  assert.match(
    offlineHelpersSource,
    /Notification preferences are available for viewing\. Connect to the internet to update your preferences\./,
  );
  assert.match(
    offlineHelpersSource,
    /System information remains available for viewing while you're offline\./,
  );
  assert.match(
    offlineHelpersSource,
    /This page is available for viewing while you're offline\./,
  );
  assert.match(
    settingsSource,
    /Account settings unavailable offline/,
  );
  assert.match(
    profileSource,
    /Connect to the internet to update account settings\./,
  );
  assert.match(
    notificationSource,
    /Changes require an internet connection\./,
  );
  assert.doesNotMatch(
    notificationSource,
    /Account settings are available for viewing/,
  );
  assert.match(
    systemSource,
    /Offline Access/,
  );
  assert.match(
    systemSource,
    /Available for supported features/,
  );
  assert.doesNotMatch(
    systemSource,
    /Connect to the internet to make changes/,
  );
});

test("settings banner source uses accessible title and description associations", async () => {
  const roleShellSource = await fs.readFile(roleShellSourcePath, "utf8");

  assert.match(roleShellSource, /aria-live="polite"/);
  assert.match(roleShellSource, /aria-labelledby=\{statusBannerTitleId\}/);
  assert.match(roleShellSource, /aria-describedby=\{statusBannerMessageId\}/);
});

test("settings offline helper copy avoids queueing and sync-later promises", async () => {
  const offlineHelpersSource = await fs.readFile(offlineHelpersSourcePath, "utf8");

  assert.doesNotMatch(offlineHelpersSource, /queue/i);
  assert.doesNotMatch(offlineHelpersSource, /sync later/i);
  assert.doesNotMatch(offlineHelpersSource, /saved locally/i);
});

test("settings banner layout does not introduce fixed heights or nowrap copy constraints", async () => {
  const roleShellSource = await fs.readFile(roleShellSourcePath, "utf8");

  assert.doesNotMatch(roleShellSource, /height:\s*["'`]/);
  assert.doesNotMatch(roleShellSource, /whiteSpace:\s*"nowrap"/);
  assert.doesNotMatch(roleShellSource, /overflowX/);
});

test("settings page still resolves section identity from activeSection instead of pathname matching", async () => {
  const settingsSource = await fs.readFile(settingsPageSourcePath, "utf8");

  assert.match(settingsSource, /activeSectionKey: activeSection/);
  assert.doesNotMatch(settingsSource, /pathname\.includes/);
  assert.doesNotMatch(settingsSource, /notification-preferences.*pathname/s);
  assert.doesNotMatch(settingsSource, /sync-preferences.*pathname/s);
});

test("settings reconnect warning remains generic rather than profile-specific", async () => {
  const offlineHelpersSource = await fs.readFile(offlineHelpersSourcePath, "utf8");

  assert.match(offlineHelpersSource, /Settings could not be refreshed/);
  assert.doesNotMatch(offlineHelpersSource, /Account settings could not be refreshed/);
});

test("system information offline copy remains view-only and non-editable", async () => {
  const offlineHelpersSource = await fs.readFile(offlineHelpersSourcePath, "utf8");

  assert.doesNotMatch(
    offlineHelpersSource,
    /System information.*update your settings/s,
  );
  assert.doesNotMatch(
    offlineHelpersSource,
    /System information.*changes require a connection/s,
  );
});
