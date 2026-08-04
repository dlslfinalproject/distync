import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const profileSectionSourcePath = new URL(
  "../src/pages/settings/components/ProfileSection.jsx",
  import.meta.url,
);
const settingsPageSourcePath = new URL(
  "../src/pages/settings/RoleSettingsPage.jsx",
  import.meta.url,
);

test("account settings email stays visible without provider helper text", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /Email Address/);
  assert.doesNotMatch(source, /Linked to your authenticated Google account\./);
  assert.doesNotMatch(source, /Google account/i);
  assert.doesNotMatch(source, /authentication provider/i);
});

test("account settings still shows assigned barangay from canonical profile data", async () => {
  const source = await fs.readFile(profileSectionSourcePath, "utf8");

  assert.match(source, /preferences\.profile\.assignedBarangay/);
  assert.match(source, /Assigned Barangay/);
  assert.match(
    source,
    /<p style=\{sectionLabelStyles\}>Assigned Barangay<\/p>[\s\S]*?preferences\.profile\.assignedBarangay/,
  );
  assert.doesNotMatch(
    source,
    /<p style=\{sectionLabelStyles\}>Assigned Barangay<\/p>[\s\S]*?<input/s,
  );
});

test("settings page no longer loads all barangays just to display the assigned barangay", async () => {
  const source = await fs.readFile(settingsPageSourcePath, "utf8");

  assert.doesNotMatch(source, /fetchBarangays/);
  assert.doesNotMatch(source, /assignedBarangayName/);
  assert.match(source, /fetchUnreadNotificationCount/);
});
