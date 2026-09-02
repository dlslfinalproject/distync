const QR_SCAN_ERROR_CODES = {
  STUB_ALREADY_CLAIMED: "STUB_ALREADY_CLAIMED",
  HOUSEHOLD_ARCHIVED: "HOUSEHOLD_ARCHIVED",
  INVALID_QR_STUB: "INVALID_QR_STUB",
  STUB_NOT_AVAILABLE_OFFLINE: "STUB_NOT_AVAILABLE_OFFLINE",
  OFFLINE_VERIFICATION_UNAVAILABLE: "OFFLINE_VERIFICATION_UNAVAILABLE",
  STUB_CLAIM_PENDING: "STUB_CLAIM_PENDING",
  STUB_CLAIM_CONFLICT: "STUB_CLAIM_CONFLICT",
  STUB_NOT_FOUND: "STUB_NOT_FOUND",
  WRONG_EVENT: "WRONG_EVENT",
  WRONG_BARANGAY: "WRONG_BARANGAY",
  QR_INACTIVE: "QR_INACTIVE",
  HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER: "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER",
  DISASTER_EVENT_NOT_ACTIVE: "DISASTER_EVENT_NOT_ACTIVE",
  STUB_CANCELLED: "STUB_CANCELLED",
  STUB_VOID: "STUB_VOID",
  STUB_UNAVAILABLE: "STUB_UNAVAILABLE",
  ACCESS_RESTRICTED: "ACCESS_RESTRICTED",
  DISTRIBUTION_FAILED: "DISTRIBUTION_FAILED",
};

const formatDisplayDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(parsedDate);
};

const buildErrorFromCode = (errorCode, errorMessage, details = {}) => {
  const error = new Error(errorMessage || "");
  error.code = errorCode || "";
  error.details = details || {};
  return error;
};

const normalizeErrorCode = (error) => {
  const normalizedCode = String(error?.code || "").trim().toUpperCase();

  if (normalizedCode) {
    return normalizedCode;
  }

  const normalizedMessage = String(error?.message || "").trim().toUpperCase();

  if (
    normalizedMessage.includes("ALREADY CLAIMED") ||
    normalizedMessage.includes("ALREADY BEEN USED")
  ) {
    return QR_SCAN_ERROR_CODES.STUB_ALREADY_CLAIMED;
  }

  if (normalizedMessage.includes("SELECTED DISASTER EVENT")) {
    return QR_SCAN_ERROR_CODES.WRONG_EVENT;
  }

  if (
    normalizedMessage.includes("ASSIGNED BARANGAY") ||
    normalizedMessage.includes("SELECTED BARANGAY")
  ) {
    return QR_SCAN_ERROR_CODES.WRONG_BARANGAY;
  }

  if (normalizedMessage.includes("NOT RECOGNIZED AS A VALID DISTYNC RELIEF STUB")) {
    return QR_SCAN_ERROR_CODES.INVALID_QR_STUB;
  }

  if (normalizedMessage.includes("STUB NOT FOUND")) {
    return QR_SCAN_ERROR_CODES.STUB_NOT_FOUND;
  }

  if (normalizedMessage.includes("NOT ACTIVE")) {
    return QR_SCAN_ERROR_CODES.QR_INACTIVE;
  }

  if (normalizedMessage.includes("HOUSEHOLD IS ARCHIVED")) {
    return QR_SCAN_ERROR_CODES.HOUSEHOLD_ARCHIVED;
  }

  return "";
};

const getClaimedStubDetailRows = (details = {}) => {
  const detailRows = [];

  if (details.stubNumber) {
    detailRows.push({
      label: "Stub Number",
      value: details.stubNumber,
    });
  }

  const claimedOnText = formatDisplayDateTime(details.claimedAt);
  if (claimedOnText) {
    detailRows.push({
      label: "Claimed On",
      value: claimedOnText,
    });
  }

  if (details.claimedByName) {
    detailRows.push({
      label: "Claimed By",
      value: details.claimedByName,
    });
  }

  if (details.reliefPackName) {
    detailRows.push({
      label: "Relief Pack",
      value: details.reliefPackName,
    });
  }

  return detailRows;
};

export const createQrScanError = ({
  code,
  message,
  details = {},
}) => buildErrorFromCode(code, message, details);

export const createWrongEventQrScanError = (details = {}) =>
  buildErrorFromCode(
    QR_SCAN_ERROR_CODES.WRONG_EVENT,
    "This stub belongs to a different disaster event. Select the correct event before scanning.",
    details,
  );

export const createWrongBarangayQrScanError = (details = {}) =>
  buildErrorFromCode(
    QR_SCAN_ERROR_CODES.WRONG_BARANGAY,
    "This stub does not belong to your assigned barangay.",
    details,
  );

export const getQrScanBlockingErrorConfig = (error) => {
  const normalizedCode = normalizeErrorCode(error);
  const details = error?.details || {};

  switch (normalizedCode) {
    case QR_SCAN_ERROR_CODES.STUB_ALREADY_CLAIMED:
      return {
        title: "Stub Already Claimed",
        message:
          "This relief stub has already been used in a completed distribution and cannot be claimed again.",
        hideDescription: true,
        showCloseButton: false,
        detailLayout: "cards",
        detailRows: getClaimedStubDetailRows(details),
      };
    case QR_SCAN_ERROR_CODES.HOUSEHOLD_ARCHIVED:
      return {
        title: "Household Archived",
        message:
          "This household is archived and cannot receive a new relief distribution.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.INVALID_QR_STUB:
      return {
        title: "Invalid QR Stub",
        message:
          "The scanned QR code is not recognized as a valid DISTYNC relief stub.",
        layout: "centeredAlert",
        maxWidth: "500px",
        messageStyle: {
          maxWidth: "360px",
        },
        detailRows: [],
      };
    case QR_SCAN_ERROR_CODES.STUB_NOT_AVAILABLE_OFFLINE:
    case QR_SCAN_ERROR_CODES.OFFLINE_VERIFICATION_UNAVAILABLE:
      return {
        title: "Unable to Verify Offline",
        message:
          "The information required to verify this QR is not available on this device. Reconnect to the internet and try again.",
        detailRows: [],
      };
    case QR_SCAN_ERROR_CODES.STUB_CLAIM_PENDING:
      return {
        title: "Claim Pending Sync",
        message:
          "This relief stub already has a pending offline claim on this device. Wait for synchronization before trying again.",
        detailRows: getClaimedStubDetailRows(details),
      };
    case QR_SCAN_ERROR_CODES.STUB_CLAIM_CONFLICT:
      return {
        title: "Claim Needs Review",
        message:
          "This relief stub has a synchronization conflict and cannot be claimed again until it is reviewed.",
        detailRows: getClaimedStubDetailRows(details),
      };
    case QR_SCAN_ERROR_CODES.STUB_NOT_FOUND:
      return {
        title: "Stub Not Found",
        message:
          "The scanned QR code is not linked to an existing relief stub.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.WRONG_EVENT:
      return {
        title: "Wrong Disaster Event",
        message:
          "This stub belongs to a different disaster event. Select the correct event before scanning.",
        layout: "centeredAlert",
        maxWidth: "500px",
        messageStyle: {
          maxWidth: "360px",
        },
        detailRows: [],
      };
    case QR_SCAN_ERROR_CODES.WRONG_BARANGAY:
      return {
        title: "Wrong Barangay",
        message:
          "This stub does not belong to your assigned barangay.",
        layout: "centeredAlert",
        maxWidth: "500px",
        messageStyle: {
          maxWidth: "360px",
        },
        detailRows: [],
      };
    case QR_SCAN_ERROR_CODES.QR_INACTIVE:
      return {
        title: "QR Stub Unavailable",
        message:
          "This QR reference is inactive and cannot be used for relief distribution.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER:
      return {
        title: "Household Not Present",
        message:
          "This stub cannot be claimed because the household is not currently present in an evacuation center.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.DISASTER_EVENT_NOT_ACTIVE:
      return {
        title: "Disaster Event Not Active",
        message:
          "This relief claim cannot be completed because the disaster event is no longer active.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.STUB_CANCELLED:
    case QR_SCAN_ERROR_CODES.STUB_VOID:
    case QR_SCAN_ERROR_CODES.STUB_UNAVAILABLE:
      return {
        title: "Stub Unavailable",
        message:
          "This relief stub is not available for distribution processing.",
        detailRows: details.stubNumber
          ? [{ label: "Stub Number", value: details.stubNumber }]
          : [],
      };
    case QR_SCAN_ERROR_CODES.ACCESS_RESTRICTED:
      return {
        title: "Access Restricted",
        message:
          "You are not authorized to process this relief stub.",
        detailRows: [],
      };
    case QR_SCAN_ERROR_CODES.DISTRIBUTION_FAILED:
      return {
        title: "Distribution Could Not Be Completed",
        message:
          "The transaction was not saved. Please try again or contact an authorized system user.",
        detailRows: [],
      };
    default:
      return {
        title: "Unable to Process QR Stub",
        message:
          error?.message ||
          "The scanned QR stub could not be processed right now. Please try again or verify the physical stub.",
        detailRows: [],
      };
  }
};

export { QR_SCAN_ERROR_CODES };
