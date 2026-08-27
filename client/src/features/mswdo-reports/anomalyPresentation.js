const ANOMALY_PRESENTATION = {
  SUSPICIOUS_DISTRIBUTION_ACTIVITY: {
    label: "Unusual Distribution Record",
    explanation:
      "DISTYNC found more than one claimed relief distribution for the same household and disaster event.",
    actionRequired: "Yes",
    nextStep:
      "Verify the household's relief distribution history and related stub or QR transaction.",
    owner: "Barangay / MSWDO",
    statusHint: "Needs Review",
  },
  SYNC_FAILED: {
    label: "Synchronization Failure",
    explanation:
      "An offline action did not reach the central DISTYNC server successfully.",
    actionRequired: "Use Sync Center",
    nextStep:
      "Open Sync Center to review the failed offline action and retry it when eligible.",
    owner: "Barangay",
    statusHint: "Retry Needed",
  },
  SYNC_CONFLICT: {
    label: "Synchronization Conflict",
    explanation:
      "An offline action conflicted with a central server record and may need review in Sync Center.",
    actionRequired: "Use Sync Center",
    nextStep: "View in Sync Center. Sync Center owns conflict resolution.",
    owner: "Sync Center",
    statusHint: "Review in Sync Center",
  },
  DUPLICATE_CLAIM_ATTEMPT: {
    label: "Possible Duplicate Relief Claim",
    explanation:
      "DISTYNC prevented a second claim because the stub had already been claimed.",
    actionRequired: "No",
    nextStep:
      "Check the claim history if more context is needed. No separate anomaly review is required.",
    owner: "Barangay",
    statusHint: "Automatically Handled",
  },
  DUPLICATE_HOUSEHOLD_REGISTRATION: {
    label: "Duplicate Household Registration",
    explanation:
      "A household registration appears to match an existing registration in the same operational context.",
    actionRequired: "Yes",
    nextStep:
      "Review the existing household registration before creating or correcting another record.",
    owner: "Barangay",
    statusHint: "Needs Review",
  },
  INVENTORY_DISTRIBUTION_MISMATCH: {
    label: "Inventory-Distribution Mismatch",
    explanation:
      "A claimed relief distribution and its inventory outflow records do not currently line up.",
    actionRequired: "Sometimes",
    nextStep:
      "Barangay verification may be required. Inventory reconciliation is handled by the appropriate municipal office.",
    owner: "Office of the Mayor / MSWDO",
    statusHint: "Municipal Review",
  },
  FAILED_STUB_OR_QR_VERIFICATION: {
    label: "Stub or QR Verification Issue",
    explanation:
      "A stub or QR verification attempt could not be matched to a claimable relief record.",
    actionRequired: "Yes",
    nextStep:
      "Verify the stub, QR code, household, and disaster event before attempting the transaction again.",
    owner: "Barangay / MSWDO",
    statusHint: "Needs Review",
  },
};

const DEFAULT_WHY_FLAGGED =
  "This record was flagged because its information does not match the expected operational data.";

const WHY_FLAGGED_BY_ANOMALY_TYPE = Object.freeze({
  SUSPICIOUS_DISTRIBUTION_ACTIVITY:
    "A later relief distribution claim created a possible duplicate for this household and disaster event.",
  SYNC_FAILED:
    "A synchronized operational update could not be recorded successfully.",
  SYNC_CONFLICT:
    "Conflicting synchronized updates were detected for this record.",
  DUPLICATE_CLAIM_ATTEMPT:
    "A relief claim was attempted after another claim already existed for this household and disaster event.",
  DUPLICATE_HOUSEHOLD_REGISTRATION:
    "The submitted household information conflicts with an existing household registration.",
  INVENTORY_DISTRIBUTION_MISMATCH:
    "The distribution record does not match the related inventory movement.",
  FAILED_STUB_OR_QR_VERIFICATION:
    "The stub or QR verification could not be matched to an eligible relief record.",
});

const MSWDO_ANOMALY_PRESENTATION_OVERRIDES = {
  SUSPICIOUS_DISTRIBUTION_ACTIVITY: {
    label: "Distribution Record Issue",
    explanation:
      "More than one claimed relief distribution was found for the same household and disaster event.",
    nextStep:
      "Review the affected household, distribution, and stub records, then coordinate validation with the Barangay.",
    owner: "MSWDO / Barangay",
    statusHint: "Open",
  },
  SYNC_FAILED: {
    label: "Synchronization Issue Detected",
    explanation:
      "A synchronization issue was detected while an operational record was being sent to the central system.",
    actionRequired: "Handled in Sync Center",
    nextStep:
      "Monitor the issue here and use Sync Center for synchronization operations or recovery.",
    owner: "Sync Center",
    statusHint: "Sync Center Review",
  },
  SYNC_CONFLICT: {
    label: "Synchronization Conflict Detected",
    explanation:
      "A local operational record conflicts with information already stored in the central system.",
    actionRequired: "Handled in Sync Center",
    nextStep:
      "Monitor the conflict here and use Sync Center for conflict review or recovery.",
    owner: "Sync Center",
    statusHint: "Sync Center Review",
  },
  DUPLICATE_CLAIM_ATTEMPT: {
    label: "Duplicate Claim Attempt",
    explanation:
      "DISTYNC prevented a second relief claim because the affected stub had already been claimed.",
    nextStep:
      "Review the claim history only if additional operational context is needed.",
    owner: "MSWDO / Barangay",
    statusHint: "Dismissed / Automatically Handled",
  },
  DUPLICATE_HOUSEHOLD_REGISTRATION: {
    label: "Duplicate Household Record",
    explanation:
      "Two household registrations may represent the same family in the same operational context.",
    nextStep:
      "Compare the affected household records and coordinate identity validation with the Barangay.",
    owner: "MSWDO / Barangay",
    statusHint: "Open",
  },
  INVENTORY_DISTRIBUTION_MISMATCH: {
    nextStep:
      "Validate the affected distribution and coordinate inventory reconciliation with the responsible municipal office.",
    owner: "MSWDO / Office of the Mayor",
    statusHint: "Open",
  },
  FAILED_STUB_OR_QR_VERIFICATION: {
    label: "Stub or QR Verification Issue",
    explanation:
      "A stub or QR verification attempt could not be matched to an eligible relief record.",
    nextStep:
      "Review the affected household, stub, and disaster event information with the Barangay.",
    owner: "MSWDO / Barangay",
    statusHint: "Open",
  },
};

export const reviewOutcomeOptions = [
  {
    value: "REVIEWED_VALID",
    label: "Valid / No Issue",
    description:
      "The unusual condition is legitimate or does not require corrective action.",
  },
  {
    value: "ISSUE_CONFIRMED",
    label: "Issue Confirmed",
    description: "The underlying operational issue is genuine.",
  },
  {
    value: "REFERRED",
    label: "Referred",
    description:
      "Barangay verification is complete and the remaining issue belongs to another authorized office.",
  },
];

export const mswdoReviewOutcomeOptions = [
  {
    value: "REVIEWED_VALID",
    label: "Dismissed / No Issue",
    description:
      "Validation found no operational inconsistency or corrective action is unnecessary.",
  },
  {
    value: "ISSUE_CONFIRMED",
    label: "Issue Confirmed",
    description:
      "Validation confirmed an operational inconsistency that must be documented or coordinated.",
  },
  {
    value: "REFERRED",
    label: "Referred for Resolution",
    description:
      "The issue was documented and referred to the Barangay or responsible municipal office.",
  },
];

const reviewOutcomeLabels = Object.fromEntries(
  reviewOutcomeOptions.map((option) => [option.value, option.label]),
);

const mswdoReviewOutcomeLabels = Object.fromEntries(
  mswdoReviewOutcomeOptions.map((option) => [option.value, option.label]),
);

export const formatReviewOutcome = (value, scope = "barangay") =>
  (scope === "mswdo" ? mswdoReviewOutcomeLabels : reviewOutcomeLabels)[value] ||
  (scope === "mswdo" ? "Open" : "Needs Review");

export const getAnomalyReviewStateLabel = (row, scope = "barangay") => {
  if (row?.review_status) {
    return formatReviewOutcome(row.review_status, scope);
  }

  if (row?.review_state === "system_handled") {
    return scope === "mswdo"
      ? "Dismissed / Automatically Handled"
      : "Automatically Handled";
  }

  if (row?.review_state === "sync_center") {
    return scope === "mswdo" ? "Sync Center Review" : "Review in Sync Center";
  }

  return (
    getAnomalyPresentation(row?.anomaly_type, scope).statusHint ||
    (scope === "mswdo" ? "Open" : "Needs Review")
  );
};

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getAnomalyPresentation = (type, scope = "barangay") => {
  const basePresentation = ANOMALY_PRESENTATION[type] || {
    label: toTitleCase(type || "Anomaly"),
    explanation: "DISTYNC detected an operational record that may need review.",
    actionRequired: "Review",
    nextStep: "Review the affected record and coordinate with the responsible office.",
    owner: "Responsible office",
    statusHint: "Needs Review",
  };

  return {
    ...basePresentation,
    whyFlagged: WHY_FLAGGED_BY_ANOMALY_TYPE[type] || DEFAULT_WHY_FLAGGED,
    ...(scope === "mswdo"
      ? {
          statusHint: "Open",
          ...(MSWDO_ANOMALY_PRESENTATION_OVERRIDES[type] || {}),
        }
      : {}),
  };
};

export const anomalyTypes = [
  { value: "all", label: "All anomaly types" },
  ...Object.entries(ANOMALY_PRESENTATION).map(([value, presentation]) => ({
    value,
    label: presentation.label,
  })),
];

export const getAnomalyTypesForScope = (scope) =>
  (scope === "barangay"
    ? anomalyTypes.filter((type) => type.value !== "SYNC_FAILED")
    : anomalyTypes
  ).map((type) =>
    type.value === "all"
      ? type
      : {
          ...type,
          label: getAnomalyPresentation(type.value, scope).label,
        },
  );

export const formatAnomalyType = (value, scope = "barangay") =>
  getAnomalyPresentation(value, scope).label;

export const getAnomalyActionSummary = (row, scope = "barangay") =>
  getAnomalyPresentation(row?.anomaly_type, scope).nextStep;

export const getAnomalyOwner = (row, scope = "barangay") =>
  getAnomalyPresentation(row?.anomaly_type, scope).owner;

export const getAnomalyActionRequired = (row, scope = "barangay") =>
  getAnomalyPresentation(row?.anomaly_type, scope).actionRequired;

export const getAnomalyExplanation = (row, scope = "barangay") => {
  const presentation = getAnomalyPresentation(row?.anomaly_type, scope);
  const normalizedWhyFlagged = String(row?.why_flagged || "").trim();
  const normalizedReason = String(row?.anomaly_reason || "").trim();
  const unsafeTechnicalPattern =
    /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|\b(?:uuid|payload|stack\s*trace|sql|constraint|database|device[_ ]?id|entity[_ ]?(?:local|server)[_ ]?id|sync[_ ]?(?:transaction|conflict)[_ ]?id)\b|\b(?:id|code|error)\s*[=:])/i;

  if (scope === "mswdo") {
    return unsafeTechnicalPattern.test(normalizedWhyFlagged)
      ? presentation.whyFlagged
      : normalizedWhyFlagged || presentation.whyFlagged;
  }

  if (normalizedReason && !unsafeTechnicalPattern.test(normalizedReason)) {
    return normalizedReason;
  }

  return presentation.explanation || DEFAULT_WHY_FLAGGED;
};
