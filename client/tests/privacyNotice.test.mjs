import test from "node:test";
import assert from "node:assert/strict";

import {
  HOUSEHOLD_REGISTRATION_FLOW_STEPS,
  HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL,
  HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS,
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

test("edit flow skips the prompt only when the current notice was already acknowledged", () => {
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
    true,
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
  assert.equal(payload.is_offline_encoded, true);
  assert.equal(payload.sync_status, "PENDING");
  assert.match(payload.acknowledged_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("privacy notice content matches the updated disaster-response wording", () => {
  const combinedNoticeText = HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS.join(" ");

  assert.match(
    combinedNoticeText,
    /DISTYNC will collect and process personal information about you and your family/i,
  );
  assert.match(
    combinedNoticeText,
    /records may be retained, archived, or securely disposed of/i,
  );
  assert.match(
    HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL,
    /I have read, or this notice has been explained to me/i,
  );
});
