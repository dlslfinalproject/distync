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
    nextStep:
      "Review the conflict in Sync Center. Only verify it here when it created an operational data concern.",
    owner: "Barangay / Authorized reviewer",
    statusHint: "Needs Review",
  },
  DUPLICATE_CLAIM_ATTEMPT: {
    label: "Possible Duplicate Relief Claim",
    explanation:
      "A stub or QR claim appears to have already been recorded for the affected household or transaction.",
    actionRequired: "Yes",
    nextStep:
      "Check the household's relief claim history before confirming another release.",
    owner: "Barangay",
    statusHint: "Needs Review",
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

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getAnomalyPresentation = (type) =>
  ANOMALY_PRESENTATION[type] || {
    label: toTitleCase(type || "Anomaly"),
    explanation: "DISTYNC detected an operational record that may need review.",
    actionRequired: "Review",
    nextStep: "Review the affected record and coordinate with the responsible office.",
    owner: "Responsible office",
    statusHint: "Needs Review",
  };

export const anomalyTypes = [
  { value: "all", label: "All anomaly types" },
  ...Object.entries(ANOMALY_PRESENTATION).map(([value, presentation]) => ({
    value,
    label: presentation.label,
  })),
];

export const getAnomalyTypesForScope = (scope) =>
  scope === "barangay"
    ? anomalyTypes.filter((type) => type.value !== "SYNC_FAILED")
    : anomalyTypes;

export const formatAnomalyType = (value) => getAnomalyPresentation(value).label;

export const getAnomalyActionSummary = (row) =>
  getAnomalyPresentation(row?.anomaly_type).nextStep;

export const getAnomalyOwner = (row) =>
  getAnomalyPresentation(row?.anomaly_type).owner;

export const getAnomalyActionRequired = (row) =>
  getAnomalyPresentation(row?.anomaly_type).actionRequired;

export const getAnomalyExplanation = (row) => {
  const presentation = getAnomalyPresentation(row?.anomaly_type);
  return row?.anomaly_reason || presentation.explanation;
};
