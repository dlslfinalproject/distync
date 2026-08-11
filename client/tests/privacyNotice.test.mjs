import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_POINTS,
  HOUSEHOLD_REGISTRATION_FLOW_STEPS,
  HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL,
  HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS,
  HOUSEHOLD_PRIVACY_NOTICE_SECTIONS,
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
  buildHouseholdPrivacyAcknowledgment,
  getInitialHouseholdRegistrationFlowStep,
  requiresHouseholdPrivacyPrompt,
} from "../src/features/household-registration/privacyNotice.mjs";

test("create flow always requires the privacy prompt", () => {
  assert.equal(
    requiresHouseholdPrivacyPrompt({
      isEditMode: false,
      privacyConsent: null,
    }),
    true,
  );
});

test("edit flow skips the prompt for existing households", () => {
  assert.equal(
    requiresHouseholdPrivacyPrompt({
      isEditMode: true,
      privacyConsent: {
        consent_status: "ACKNOWLEDGED",
        notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
      },
    }),
    false,
  );

  assert.equal(
    requiresHouseholdPrivacyPrompt({
      isEditMode: true,
      privacyConsent: {
        consent_status: "ACKNOWLEDGED",
        notice_version: "2026-06-01-v1",
      },
    }),
    false,
  );

  assert.equal(
    requiresHouseholdPrivacyPrompt({
      isEditMode: true,
      privacyConsent: null,
    }),
    false,
  );
});

test("registration flow starts at the privacy notice until acknowledgment is required", () => {
  assert.equal(
    getInitialHouseholdRegistrationFlowStep({
      requiresPrivacyAcknowledgment: true,
    }),
    HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE,
  );

  assert.equal(
    getInitialHouseholdRegistrationFlowStep({
      requiresPrivacyAcknowledgment: false,
    }),
    HOUSEHOLD_REGISTRATION_FLOW_STEPS.REGISTRATION_FORM,
  );
});

test("privacy acknowledgment payload uses the current notice version and offline metadata", () => {
  const payload = buildHouseholdPrivacyAcknowledgment({
    isOffline: true,
  });

  assert.equal(payload.notice_version, HOUSEHOLD_PRIVACY_NOTICE_VERSION);
  assert.equal(payload.consent_status, "ACKNOWLEDGED");
  assert.equal(payload.acknowledged_by_name, null);
  assert.equal(payload.representative_relationship, null);
  assert.equal(payload.is_offline_encoded, true);
  assert.equal(payload.sync_status, "PENDING");
  assert.match(payload.acknowledged_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("privacy notice content matches the approved titled sections and acknowledgment text", () => {
  const combinedNoticeText = HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS.join(" ");
  const sectionTitles = HOUSEHOLD_PRIVACY_NOTICE_SECTIONS.map(
    (section) => section.title,
  );

  assert.deepEqual(sectionTitles.slice(0, 3), [
    "Introduction",
    "Information Collected",
    "Purpose of Collection and Use",
  ]);
  assert.match(
    combinedNoticeText,
    /your family members' names, ages, birth dates, sex, contact information/i,
  );
  assert.match(
    combinedNoticeText,
    /Public users, donors, nongovernmental organizations, and unauthorized personnel will not be given access/i,
  );
  assert.match(
    HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL,
    /I have read, or this Data Privacy Notice has been explained to me/i,
  );
  assert.match(
    HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_POINTS.join(" "),
    /only authorized personnel may access your family's records/i,
  );
});

test("privacy consent modal only resets scroll when a new notice session opens", async () => {
  const modalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "household-registration",
    "DataPrivacyConsentModal.jsx",
  );
  const modalSource = await fs.readFile(modalPath, "utf8");

  assert.match(
    modalSource,
    /if \(scrollableBodyElement\) {\s+scrollableBodyElement\.scrollTop = 0;\s+}/,
  );
  assert.match(
    modalSource,
    /useEffect\(\(\) => {\s+if \(!isOpen\) {\s+return undefined;\s+}\s+\s+const dialogElement = dialogRef\.current;\s+const scrollableBodyElement = bodyRef\.current;[\s\S]*?}\s*, \[isOpen\]\);/,
  );
  assert.doesNotMatch(
    modalSource,
    /\}, \[isOpen, isChecked, isSubmitting\]\);/,
  );
});
