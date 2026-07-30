export const HOUSEHOLD_PRIVACY_NOTICE_VERSION = "2026-07-30-v2";

export const HOUSEHOLD_PRIVACY_NOTICE_TITLE =
  "Data Privacy Notice and Acknowledgment";

export const HOUSEHOLD_PRIVACY_NOTICE_SECTIONS = [
  {
    title: "Introduction",
    paragraphs: [
      "DISTYNC will collect and process personal information about you and your family to support official disaster-response operations in the Municipality of Malvar, Batangas.",
    ],
  },
  {
    title: "Information Collected",
    paragraphs: [
      "The information that may be collected includes your family members' names, ages, birth dates, sex, contact information, address, household relationships, vulnerability classifications, evacuation information, attendance records, relief-distribution records, and a photograph of the registered family head.",
      "Only information needed for official disaster-response operations will be collected and recorded.",
    ],
  },
  {
    title: "Purpose of Collection and Use",
    paragraphs: [
      "Your family's personal information will be used for authorized disaster-response purposes, including:",
    ],
    bulletPoints: [
      "Family and evacuee registration",
      "Attendance and evacuation-status monitoring",
      "Beneficiary identification and verification",
      "Relief-goods distribution and proof-of-receipt recording",
      "Relief inventory planning and allocation",
      "Preparation of official disaster-response reports",
      "Coordination among authorized Barangay Officials, the Municipal Social Welfare and Development Office, and the Office of the Mayor",
    ],
    postBulletParagraphs: [
      "Your family's information will not be used for purposes unrelated to authorized disaster-response operations.",
    ],
  },
  {
    title: "Use of the Family Head Photograph",
    paragraphs: [
      "The photograph of the registered family head will be used only for manual visual verification during relief distribution.",
      "DISTYNC does not use facial recognition, biometric authentication, automated identity matching, or similar technologies.",
    ],
  },
  {
    title: "Authorized Access",
    paragraphs: [
      "Your family's personal information will only be accessible to authorized personnel according to their official duties and assigned system roles.",
      "Authorized users may include designated Barangay Officials, Municipal Social Welfare and Development Office personnel, and Office of the Mayor personnel who require access to perform official disaster-response responsibilities.",
      "Public users, donors, nongovernmental organizations, and unauthorized personnel will not be given access to detailed family or evacuee records.",
    ],
  },
  {
    title: "Protection of Personal Information",
    paragraphs: [
      "Appropriate organizational and technical safeguards will be used to protect your family's personal information against unauthorized access, alteration, disclosure, misuse, loss, or destruction.",
      "These safeguards may include role-based access restrictions, secure system authentication, protected data transmission, audit logging, controlled record access, and other security measures implemented by the Municipality of Malvar.",
    ],
  },
  {
    title: "Official Reports and Data Sharing",
    paragraphs: [
      "Your family's information may be included in official disaster-response monitoring, summaries, and reports required by authorized government offices.",
      "Where appropriate, reports may present consolidated or summarized information rather than complete personal records. Detailed personal information will only be shared with authorized offices when necessary for official disaster-response, reporting, coordination, or legal purposes.",
    ],
  },
  {
    title: "Records Retention and Disposal",
    paragraphs: [
      "Your family's records may be retained for the period required by applicable LGU records-management, archival, disaster-response, and data-retention policies.",
      "After the applicable retention period, records may be securely archived or disposed of using approved procedures designed to prevent unauthorized access or recovery.",
    ],
  },
  {
    title: "Accuracy and Correction of Information",
    paragraphs: [
      "You may request the correction of inaccurate or incomplete personal information recorded about you or your family.",
      "Requests for correction will be reviewed and processed by the appropriate authorized LGU office, subject to verification and applicable records-management procedures.",
    ],
  },
  {
    title: "Questions and Privacy Concerns",
    paragraphs: [
      "You may request clarification or assistance regarding the collection, use, storage, protection, correction, retention, or disposal of your family's personal information.",
      "Privacy-related questions, requests, or concerns may be directed to the designated LGU office or Data Protection Officer through the official contact information provided by the Municipality of Malvar.",
    ],
  },
];

export const HOUSEHOLD_PRIVACY_NOTICE_PARAGRAPHS =
  HOUSEHOLD_PRIVACY_NOTICE_SECTIONS.flatMap((section) => [
    section.title,
    ...(section.paragraphs || []),
    ...(section.bulletPoints || []),
    ...(section.postBulletParagraphs || []),
  ]);

export const HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_HEADING = "Acknowledgment";

export const HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_POINTS = [
  "You have read this Data Privacy Notice, or it has been explained to you in a language and manner you understand.",
  "You understand what information will be collected about you and your family.",
  "You understand why the information is needed and how it will be used.",
  "You understand that only authorized personnel may access your family's records for official disaster-response purposes.",
  "You understand that the family head's photograph will only be used for manual beneficiary verification.",
  "You understand that you may request clarification or correction of inaccurate information through the appropriate LGU office.",
];

export const HOUSEHOLD_PRIVACY_CONFIRMATION_LABEL =
  "I have read, or this Data Privacy Notice has been explained to me, and I understand how my family's personal information will be collected, used, stored, accessed, protected, retained, and disposed of for official disaster-response purposes.";

export const HOUSEHOLD_PRIVACY_CONFIRM_BUTTON_LABEL =
  "Confirm Acknowledgment and Continue";

export const HOUSEHOLD_PRIVACY_REPRESENTATIVE_RELATIONSHIP_OPTIONS = [
  "Family Head",
  "Spouse",
  "Parent",
  "Adult Child",
  "Sibling",
  "Legal Guardian",
  "Other Authorized Representative",
];

export const HOUSEHOLD_PRIVACY_OTHER_RELATIONSHIP_OPTION =
  "Other Authorized Representative";

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
  acknowledgedByName = null,
  representativeRelationship = null,
  familyHead = null,
  isOffline = false,
}) => {
  const explicitAcknowledgedByName = String(acknowledgedByName || "").trim();
  const fallbackAcknowledgedByName = buildHouseholdAcknowledgedName(
    familyHead || {},
  );
  const normalizedRepresentativeRelationship = String(
    representativeRelationship || "",
  ).trim();

  return {
    consent_status: "ACKNOWLEDGED",
    notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
    acknowledged_at: new Date().toISOString(),
    acknowledged_by_name:
      explicitAcknowledgedByName || fallbackAcknowledgedByName || null,
    representative_relationship: normalizedRepresentativeRelationship || null,
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
