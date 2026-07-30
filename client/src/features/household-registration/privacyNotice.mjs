export const HOUSEHOLD_PRIVACY_NOTICE_VERSION = "2026-07-30-v2";

export const HOUSEHOLD_PRIVACY_NOTICE_TITLE =
  "Data Privacy Notice and Acknowledgment";

export const HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS = [
  "DISTYNC will collect and process personal information about you and your family to support official disaster-response operations in the Municipality of Malvar, Batangas.",
  "The information that may be collected includes names, ages, birth dates, sex, contact information, address, household relationships, vulnerability classifications, evacuation information, attendance records, relief-distribution records, and a photograph of the registered family head.",
  "Your family's information will be used only for authorized disaster-response purposes, including family and evacuee registration, attendance monitoring, beneficiary verification, relief distribution, inventory planning, report generation, and coordination among authorized Barangay Officials, the Municipal Social Welfare and Development Office, and the Office of the Mayor.",
  "The photograph of the registered family head will be used only for manual visual verification during relief distribution. DISTYNC does not use facial recognition, biometric authentication, or automated identity matching.",
  "Your family's personal information will only be accessible to authorized personnel according to their official roles. Appropriate organizational and technical safeguards will be used to protect the information from unauthorized access, alteration, disclosure, or loss.",
  "Your family's records may be included in official disaster-response monitoring and reports. These records may be retained, archived, or securely disposed of according to applicable LGU records-management and data-retention policies.",
  "You may request clarification, correction of inaccurate information, or assistance regarding the handling of your family's personal information by contacting the designated LGU office or Data Protection Officer through the official contact information of the Municipality of Malvar.",
];

export const HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_HEADING = "Acknowledgment";

export const HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL =
  "I have read, or this notice has been explained to me, and I understand how my family's personal information will be collected, used, stored, and protected for official disaster-response purposes.";

export const HOUSEHOLD_PRIVACY_CONFIRM_BUTTON_LABEL =
  "Confirm Acknowledgment and Continue";

export const HOUSEHOLD_PRIVACY_CONFIRMATION_ERROR =
  "Please confirm that the Data Privacy Notice was explained before continuing.";

export const HOUSEHOLD_PRIVACY_OFFLINE_MESSAGE =
  "The Data Privacy acknowledgment and family registration will be stored on this device and synchronized when an internet connection is restored.";

export const HOUSEHOLD_PRIVACY_REGISTRATION_ERROR_MESSAGE =
  "The family registration could not be completed because the Data Privacy acknowledgment was not saved. No family record was created. Please try again.";

export const HOUSEHOLD_REGISTRATION_FLOW_STEPS = {
  PRIVACY_NOTICE: "privacy_notice",
  REGISTRATION_FORM: "registration_form",
  SUBMITTING: "submitting",
  COMPLETED: "completed",
};

export const isCurrentHouseholdPrivacyConsent = (privacyConsent) => {
  if (!privacyConsent) {
    return false;
  }

  return (
    String(privacyConsent.consent_status || "").toUpperCase() ===
      "ACKNOWLEDGED" &&
    String(privacyConsent.notice_version || "") ===
      HOUSEHOLD_PRIVACY_NOTICE_VERSION
  );
};

export const requiresHouseholdPrivacyPrompt = ({
  isEditMode,
  privacyConsent,
}) => {
  if (!isEditMode) {
    return true;
  }

  return !isCurrentHouseholdPrivacyConsent(privacyConsent);
};

export const buildHouseholdAcknowledgedName = (familyHead = {}) => {
  return [
    familyHead.first_name,
    familyHead.middle_name,
    familyHead.last_name,
    familyHead.suffix,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
};

export const buildHouseholdPrivacyAcknowledgment = ({
  familyHead = null,
  isOffline = false,
}) => {
  const acknowledgedByName = buildHouseholdAcknowledgedName(familyHead || {});

  return {
    consent_status: "ACKNOWLEDGED",
    notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
    acknowledged_at: new Date().toISOString(),
    acknowledged_by_name: acknowledgedByName || null,
    representative_relationship: null,
    device_id: null,
    is_offline_encoded: isOffline,
    sync_status: isOffline ? "PENDING" : "SYNCED",
  };
};

export const getInitialHouseholdRegistrationFlowStep = ({
  requiresPrivacyAcknowledgment,
}) => {
  return requiresPrivacyAcknowledgment
    ? HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE
    : HOUSEHOLD_REGISTRATION_FLOW_STEPS.REGISTRATION_FORM;
};
