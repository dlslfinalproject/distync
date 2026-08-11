import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  DEFAULT_SETTINGS_SECTION,
  getSettingsSectionFromSearchParams,
  getSettingsSectionNormalization,
  isValidSettingsSection,
  SETTINGS_SECTIONS,
  withSettingsSection,
} from "../src/pages/settings/settingsSectionRouting.js";

const roleSettingsPageSourcePath = new URL(
  "../src/pages/settings/RoleSettingsPage.jsx",
  import.meta.url,
);
const roleShellSourcePath = new URL(
  "../src/pages/settings/components/RoleSettingsViewShell.jsx",
  import.meta.url,
);
const sidebarAccountMenuSourcePath = new URL(
  "../src/components/layout/SidebarAccountMenu.jsx",
  import.meta.url,
);

test("settings section routing accepts only the canonical query values", () => {
  assert.equal(isValidSettingsSection(SETTINGS_SECTIONS.ACCOUNT), true);
  assert.equal(isValidSettingsSection(SETTINGS_SECTIONS.NOTIFICATIONS), true);
  assert.equal(isValidSettingsSection(SETTINGS_SECTIONS.SYSTEM), true);
  assert.equal(isValidSettingsSection("profile"), false);
  assert.equal(isValidSettingsSection("SYSTEM"), false);
  assert.equal(isValidSettingsSection(""), false);
});

test("settings section routing falls back to account for missing and invalid section values", () => {
  assert.equal(
    getSettingsSectionFromSearchParams(new URLSearchParams("")),
    DEFAULT_SETTINGS_SECTION,
  );
  assert.equal(
    getSettingsSectionFromSearchParams(
      new URLSearchParams("section=notifications"),
    ),
    SETTINGS_SECTIONS.NOTIFICATIONS,
  );
  assert.equal(
    getSettingsSectionFromSearchParams(new URLSearchParams("section=invalid")),
    DEFAULT_SETTINGS_SECTION,
  );
});

test("settings section normalization preserves unrelated query parameters and collapses duplicate section values", () => {
  const invalidNormalization = getSettingsSectionNormalization(
    new URLSearchParams("mode=development&section=invalid"),
  );

  assert.equal(invalidNormalization.shouldNormalize, true);
  assert.equal(invalidNormalization.section, DEFAULT_SETTINGS_SECTION);
  assert.equal(
    invalidNormalization.params.toString(),
    "mode=development&section=account",
  );

  const duplicateNormalization = getSettingsSectionNormalization(
    new URLSearchParams("section=notifications&mode=demo&section=system"),
  );

  assert.equal(duplicateNormalization.shouldNormalize, true);
  assert.equal(
    duplicateNormalization.params.toString(),
    "mode=demo&section=notifications",
  );

  const nextParams = withSettingsSection(
    new URLSearchParams("mode=development&section=account"),
    SETTINGS_SECTIONS.SYSTEM,
  );

  assert.equal(nextParams.toString(), "mode=development&section=system");
});

test("settings page source derives subsection state from search params and normalizes invalid URLs", async () => {
  const source = await fs.readFile(roleSettingsPageSourcePath, "utf8");

  assert.match(source, /const \[searchParams, setSearchParams\] = useSearchParams\(\);/);
  assert.match(source, /getSettingsSectionNormalization\(searchParams\)/);
  assert.match(source, /setSearchParams\(settingsSectionState\.params, \{ replace: true \}\);/);
  assert.match(source, /const nextParams = withSettingsSection\(searchParams, nextSection\);/);
  assert.match(source, /setSearchParams\(nextParams\);/);
});

test("settings shell keeps subsection cards visible and marks the active section accessibly", async () => {
  const source = await fs.readFile(roleShellSourcePath, "utf8");

  assert.match(source, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(source, /Current section/);
});

test("account menu provides the existing role-specific settings destinations", async () => {
  const source = await fs.readFile(sidebarAccountMenuSourcePath, "utf8");

  assert.match(source, /settingsRoute: "\/barangay\/settings"/);
  assert.match(source, /settingsRoute: "\/mswdo\/settings"/);
  assert.match(source, /settingsRoute: "\/inventory\/settings"/);
  assert.match(source, /Account Settings/);
});
