import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  buildSettingsStatusBanner,
  buildSettingsConflictSnapshot,
  getSettingsOfflineMessage,
  hasCachedRoleSettingsData,
  mergeRefreshedSettingsWithLocalDraft,
  SETTINGS_OFFLINE_MESSAGES,
} from "../src/pages/settings/settingsOfflineHelpers.js";

const settingsConfigSourcePath = new URL(
  "../src/pages/settings/settingsConfig.js",
  import.meta.url,
);

test("hasCachedRoleSettingsData distinguishes empty defaults from safe cached settings", () => {
  assert.equal(hasCachedRoleSettingsData({}), false);
  assert.equal(
    hasCachedRoleSettingsData({
      roleCode: "BARANGAY",
      profile: {
        emailAddress: "barangay@example.com",
      },
    }),
    true,
  );
});

test("buildSettingsConflictSnapshot keeps stable fields only", () => {
  const snapshot = buildSettingsConflictSnapshot({
    roleCode: "MSWDO",
    profile: {
      firstName: "Ana",
      middleName: "De Leon",
      lastName: "Reyes",
      contactNumber: "+639171234567",
      emailAddress: "mswdo@example.com",
      position: "MSWDO Personnel",
      assignedBarangay: {
        id: "barangay-1",
        name: "San Juan",
      },
      profilePicturePath: "user-1/avatar.webp",
      profilePictureFileName: "avatar.webp",
      profilePictureUrl:
        "https://example.supabase.co/storage/v1/object/sign/distync-profile-pictures/user-1/avatar.webp?token=123",
      profilePictureUrlExpiresAt: "2099-01-01T00:00:00.000Z",
    },
    notificationRulePreferences: {
      DISTRIBUTION_COMPLETED: { inApp: true, email: false },
    },
  });

  assert.equal("profilePictureUrl" in snapshot.profile, false);
  assert.equal("profilePictureUrlExpiresAt" in snapshot.profile, false);
  assert.equal(snapshot.profile.profilePicturePath, "user-1/avatar.webp");
});

test("mergeRefreshedSettingsWithLocalDraft preserves local editable drafts while refreshing authoritative read-only fields", () => {
  const merged = mergeRefreshedSettingsWithLocalDraft({
    refreshedSettings: {
      roleCode: "BARANGAY",
      profile: {
        firstName: "Server",
        middleName: "",
        lastName: "User",
        contactNumber: "+639111111111",
        emailAddress: "updated@example.com",
        position: "Barangay Official",
        assignedBarangay: {
          id: "barangay-2",
          name: "Santiago",
        },
        profilePicturePath: "user-1/server-avatar.webp",
      },
      notificationRulePreferences: {
        DISTRIBUTION_COMPLETED: { inApp: false, email: false },
      },
      effectiveNotificationChannels: {
        DISTRIBUTION_COMPLETED: { inApp: false, email: false },
      },
      categories: [
        {
          code: "RELIEF",
          rules: [{ code: "DISTRIBUTION_COMPLETED" }],
        },
      ],
    },
    currentPreferences: {
      profile: {
        firstName: "Local",
        middleName: "Draft",
        lastName: "User",
        contactNumber: "+639222222222",
      },
      notificationRulePreferences: {
        DISTRIBUTION_COMPLETED: { inApp: true, email: true },
      },
      effectiveNotificationChannels: {
        DISTRIBUTION_COMPLETED: { inApp: true, email: true },
      },
      categories: [
        {
          code: "RELIEF",
          rules: [
            {
              code: "DISTRIBUTION_COMPLETED",
              effectiveChannels: { inApp: true, email: true },
            },
          ],
        },
      ],
    },
    preserveProfileDraft: true,
    preserveNotificationDraft: true,
  });

  assert.equal(merged.profile.firstName, "Local");
  assert.equal(merged.profile.middleName, "Draft");
  assert.equal(merged.profile.contactNumber, "+639222222222");
  assert.equal(merged.profile.emailAddress, "updated@example.com");
  assert.equal(merged.profile.assignedBarangay.name, "Santiago");
  assert.equal(merged.profile.profilePicturePath, "user-1/server-avatar.webp");
  assert.deepEqual(merged.notificationRulePreferences, {
    DISTRIBUTION_COMPLETED: { inApp: true, email: true },
  });
});

test("getSettingsOfflineMessage returns page-specific messages and a safe fallback", () => {
  assert.deepEqual(
    getSettingsOfflineMessage("account-settings"),
    SETTINGS_OFFLINE_MESSAGES["account-settings"],
  );
  assert.deepEqual(
    getSettingsOfflineMessage("notification-preferences"),
    SETTINGS_OFFLINE_MESSAGES["notification-preferences"],
  );
  assert.deepEqual(
    getSettingsOfflineMessage("sync-preferences"),
    SETTINGS_OFFLINE_MESSAGES["sync-preferences"],
  );
  assert.deepEqual(
    getSettingsOfflineMessage("unknown-section"),
    SETTINGS_OFFLINE_MESSAGES.fallback,
  );
});

test("buildSettingsStatusBanner uses section-aware offline copy and preserves reconnect warnings", () => {
  assert.deepEqual(
    buildSettingsStatusBanner({
      activeSectionKey: "notification-preferences",
      isOnline: false,
      hasUnsavedChanges: false,
      isReconnectRefreshBlocked: false,
    }),
    SETTINGS_OFFLINE_MESSAGES["notification-preferences"],
  );

  assert.deepEqual(
    buildSettingsStatusBanner({
      activeSectionKey: "sync-preferences",
      isOnline: false,
      hasUnsavedChanges: false,
      isReconnectRefreshBlocked: false,
    }),
    SETTINGS_OFFLINE_MESSAGES["sync-preferences"],
  );

  assert.deepEqual(
    buildSettingsStatusBanner({
      activeSectionKey: null,
      isOnline: false,
      hasUnsavedChanges: false,
      isReconnectRefreshBlocked: false,
    }),
    SETTINGS_OFFLINE_MESSAGES.fallback,
  );

  assert.deepEqual(
    buildSettingsStatusBanner({
      activeSectionKey: "account-settings",
      isOnline: false,
      hasUnsavedChanges: true,
      isReconnectRefreshBlocked: false,
    }),
    {
      title: "Connection lost",
      message: "Your changes are not saved. Reconnect to continue.",
    },
  );

  assert.deepEqual(
    buildSettingsStatusBanner({
      activeSectionKey: "account-settings",
      isOnline: true,
      hasUnsavedChanges: false,
      isReconnectRefreshBlocked: true,
    }),
    {
      title: "Settings could not be refreshed",
      message: "Please try again before saving changes.",
    },
  );
});

test("all role settings section configs expose the same notification and system-information keys", async () => {
  const source = await fs.readFile(settingsConfigSourcePath, "utf8");

  const accountSettingsMatches = source.match(/key: "account-settings"/g) || [];
  const notificationMatches =
    source.match(/key: "notification-preferences"/g) || [];
  const systemInformationMatches = source.match(/key: "sync-preferences"/g) || [];

  assert.equal(accountSettingsMatches.length, 3);
  assert.equal(notificationMatches.length, 3);
  assert.equal(systemInformationMatches.length, 3);
});
