import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  createSettingsBeforeUnloadHandler,
  hasProfileSettingsChanges,
  hasRoleSettingsUnsavedChanges,
  normalizeSettingsProfileForDirtyCheck,
  shouldBlockSettingsRouteLeave,
} from "../src/pages/settings/settingsUnsavedChanges.js";
import {
  buildPictureDraftForRemoval,
  buildPictureDraftForSelection,
  createProfilePictureDraftState,
} from "../src/pages/settings/profilePictureDraft.js";

const roleSettingsPageSourcePath = new URL(
  "../src/pages/settings/RoleSettingsPage.jsx",
  import.meta.url,
);
const appRoutesSourcePath = new URL(
  "../src/routes/AppRoutes.jsx",
  import.meta.url,
);
const sidebarAccountMenuSourcePath = new URL(
  "../src/components/layout/SidebarAccountMenu.jsx",
  import.meta.url,
);
const barangayLayoutSourcePath = new URL(
  "../src/components/layout/BarangayLayout.jsx",
  import.meta.url,
);
const authContextSourcePath = new URL(
  "../src/context/AuthContext.jsx",
  import.meta.url,
);

const basePreferences = {
  roleCode: "BARANGAY",
  profile: {
    firstName: "Maria",
    middleName: "Santos",
    lastName: "Dela Cruz",
    contactNumber: "+639171234567",
    emailAddress: "maria@example.test",
    profilePicturePath: "user-1/avatar.webp",
    profilePictureUrl: "https://signed.example.test/avatar.webp?token=old",
    profilePictureUrlExpiresAt: "2026-08-08T08:00:00.000Z",
  },
  categories: [
    {
      code: "DISASTER_COORDINATION",
      label: "Disaster Coordination",
      rules: [
        {
          code: "DISASTER_EVENT_CREATED",
          editableChannels: { inApp: false, email: true },
          effectiveChannels: { inApp: true, email: true },
        },
      ],
    },
  ],
};

const clonePreferences = (preferences = basePreferences) =>
  JSON.parse(JSON.stringify(preferences));

test("settings dirty profile normalization avoids formatting and signed URL false positives", () => {
  const currentPreferences = clonePreferences();
  const savedPreferences = clonePreferences();
  currentPreferences.profile.contactNumber = "0917 123 4567";
  currentPreferences.profile.profilePictureUrl =
    "https://signed.example.test/avatar.webp?token=refreshed";
  currentPreferences.profile.profilePictureUrlExpiresAt =
    "2026-08-08T09:00:00.000Z";

  assert.deepEqual(
    normalizeSettingsProfileForDirtyCheck(currentPreferences),
    normalizeSettingsProfileForDirtyCheck(savedPreferences),
  );
  assert.equal(
    hasProfileSettingsChanges({
      currentPreferences,
      savedPreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    false,
  );
});

test("settings dirty state includes editable profile text, middle-name clearing, and contact changes", () => {
  const firstNameDraft = clonePreferences();
  firstNameDraft.profile.firstName = "Maria Angela";

  assert.equal(
    hasProfileSettingsChanges({
      currentPreferences: firstNameDraft,
      savedPreferences: basePreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    true,
  );

  const middleNameCleared = clonePreferences();
  middleNameCleared.profile.middleName = "";

  assert.equal(
    hasProfileSettingsChanges({
      currentPreferences: middleNameCleared,
      savedPreferences: basePreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    true,
  );

  const contactDraft = clonePreferences();
  contactDraft.profile.contactNumber = "+639181234567";

  assert.equal(
    hasProfileSettingsChanges({
      currentPreferences: contactDraft,
      savedPreferences: basePreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    true,
  );
});

test("settings dirty state includes notification, picture replacement, and picture removal drafts", () => {
  const notificationDraft = clonePreferences();
  notificationDraft.categories[0].rules[0].effectiveChannels.email = false;

  assert.equal(
    hasRoleSettingsUnsavedChanges({
      currentPreferences: notificationDraft,
      savedPreferences: basePreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    true,
  );

  assert.equal(
    hasRoleSettingsUnsavedChanges({
      currentPreferences: basePreferences,
      savedPreferences: basePreferences,
      profilePictureDraft: buildPictureDraftForSelection({
        file: new File(["avatar"], "avatar.webp", { type: "image/webp" }),
        previewUrl: "blob:avatar-preview",
      }),
    }),
    true,
  );

  assert.equal(
    hasRoleSettingsUnsavedChanges({
      currentPreferences: basePreferences,
      savedPreferences: basePreferences,
      profilePictureDraft: buildPictureDraftForRemoval(),
    }),
    true,
  );
});

test("settings dirty state clears when values are reverted to the saved baseline", () => {
  const revertedPreferences = clonePreferences();
  revertedPreferences.profile.firstName = "Maria Angela";
  revertedPreferences.profile.firstName = "Maria";

  assert.equal(
    hasRoleSettingsUnsavedChanges({
      currentPreferences: revertedPreferences,
      savedPreferences: basePreferences,
      profilePictureDraft: createProfilePictureDraftState(),
    }),
    false,
  );
});

test("settings route leave blocker ignores same-path section changes and blocks route exits only when dirty", () => {
  assert.equal(
    shouldBlockSettingsRouteLeave({
      hasUnsavedChanges: true,
      currentLocation: {
        pathname: "/barangay/settings",
        search: "?section=account",
      },
      nextLocation: {
        pathname: "/barangay/settings",
        search: "?section=notifications",
      },
    }),
    false,
  );

  assert.equal(
    shouldBlockSettingsRouteLeave({
      hasUnsavedChanges: true,
      currentLocation: { pathname: "/barangay/settings" },
      nextLocation: { pathname: "/barangay/masterlist" },
    }),
    true,
  );

  assert.equal(
    shouldBlockSettingsRouteLeave({
      hasUnsavedChanges: false,
      currentLocation: { pathname: "/barangay/settings" },
      nextLocation: { pathname: "/barangay/masterlist" },
    }),
    false,
  );
});

test("settings beforeunload handler requests the native browser warning", () => {
  const handler = createSettingsBeforeUnloadHandler();
  const event = {
    prevented: false,
    returnValue: undefined,
    preventDefault() {
      this.prevented = true;
    },
  };

  assert.equal(handler(event), "");
  assert.equal(event.prevented, true);
  assert.equal(event.returnValue, "");
});

test("settings page wires router blocking and the DISTYNC modal without browser confirm or alert", async () => {
  const source = await fs.readFile(roleSettingsPageSourcePath, "utf8");

  assert.match(source, /useBlocker/);
  assert.match(source, /shouldBlockSettingsRouteLeave/);
  assert.match(source, /createSettingsBeforeUnloadHandler/);
  assert.match(source, /Discard Changes and Leave/);
  assert.match(source, /Stay on This Page/);
  assert.match(source, /routeLeaveBlocker\.reset\(\)/);
  assert.match(source, /routeLeaveBlocker\.proceed\(\)/);
  assert.doesNotMatch(source, /window\.confirm|[^A-Za-z]confirm\(/);
  assert.doesNotMatch(source, /window\.alert|[^A-Za-z]alert\(/);
});

test("settings voluntary logout guard defers auth clearing until dirty settings are confirmed", async () => {
  const [settingsSource, menuSource, layoutSource, authSource] =
    await Promise.all([
      fs.readFile(roleSettingsPageSourcePath, "utf8"),
      fs.readFile(sidebarAccountMenuSourcePath, "utf8"),
      fs.readFile(barangayLayoutSourcePath, "utf8"),
      fs.readFile(authContextSourcePath, "utf8"),
    ]);

  assert.match(layoutSource, /SettingsUnsavedChangesProvider/);
  assert.match(menuSource, /requestVoluntaryLogout\(\{/);
  assert.match(menuSource, /onConfirm: completeLogout/);
  assert.match(menuSource, /if \(wasSettingsLogoutIntercepted\) \{\s*return;/);
  assert.match(settingsSource, /registerVoluntaryLogoutGuard/);
  assert.match(settingsSource, /hasUnsavedChangesRef\.current/);
  assert.match(settingsSource, /setUnsavedModalMode\("logout"\)/);
  assert.match(settingsSource, /Logging out will discard them/);
  assert.match(settingsSource, /Stay on This Page/);
  assert.match(settingsSource, /Discard Changes and Logout/);
  assert.match(settingsSource, /setIsConfirmedLogoutPending\(true\)/);
  assert.match(settingsSource, /if \(!isConfirmedLogoutPending \|\| hasUnsavedChanges\)/);
  assert.match(settingsSource, /confirmedLogout\(\)/);
  assert.doesNotMatch(authSource, /useSettingsUnsavedChangesGuard|SettingsUnsavedChangesProvider/);
});

test("forced auth invalidation remains outside the voluntary settings logout guard", async () => {
  const [authSource, menuSource] = await Promise.all([
    fs.readFile(authContextSourcePath, "utf8"),
    fs.readFile(sidebarAccountMenuSourcePath, "utf8"),
  ]);

  assert.match(authSource, /AUTH_SESSION_INVALIDATED_EVENT/);
  assert.match(authSource, /handleAuthSessionInvalidated/);
  assert.match(authSource, /resetAuthenticatedBrowserState\(\{/);
  assert.match(menuSource, /requestVoluntaryLogout/);
  assert.doesNotMatch(authSource, /requestVoluntaryLogout/);
});

test("application router uses the React Router data router required by useBlocker", async () => {
  const source = await fs.readFile(appRoutesSourcePath, "utf8");

  assert.match(source, /createBrowserRouter/);
  assert.match(source, /<RouterProvider router=\{router\} \/>/);
  assert.doesNotMatch(source, /<BrowserRouter>/);
});
