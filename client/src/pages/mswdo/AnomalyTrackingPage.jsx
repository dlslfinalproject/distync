import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEye, FiFilter, FiSearch } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { pageSpacingStyles, shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import FormModalShell from "../../components/shared/FormModalShell";
import LoadingState from "../../components/shared/LoadingState";
import StatusCard from "../../components/shared/StatusCard";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
import {
  fetchAllDisasterEvents,
  fetchBarangayDisasterEventOptions,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import {
  formatAnomalyType,
  formatReviewOutcome,
  getAnomalyActionSummary,
  getAnomalyExplanation,
  getAnomalyOwner,
  getAnomalySeverity,
  getAnomalyTypesForScope,
  getAnomalyPresentation,
  getAnomalyReviewStateLabel,
  mswdoReviewOutcomeOptions,
  reviewOutcomeOptions,
} from "../../features/mswdo-reports/anomalyPresentation";
import {
  fetchMswdoAnomalies,
  saveAnomalyReview,
} from "../../features/mswdo-reports/mswdoReportService";

const inputStyles = {
  width: "100%",
  minHeight: "46px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cfddeb",
  backgroundColor: "#f8fbfe",
  color: "#1f3b57",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#5f7892",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
  },
  th: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "normal",
    wordBreak: "normal",
    overflowWrap: "normal",
  },
  td: {
    padding: "16px",
    borderBottom: "1px solid #edf3f8",
    color: "#17324d",
    fontSize: "14px",
    verticalAlign: "middle",
    lineHeight: 1.5,
    wordBreak: "normal",
    overflowWrap: "break-word",
  },
};

const barangayAnomalyTableMinWidth = "1240px";
const mswdoAnomalyTableMinWidth = "1160px";

const barangayAnomalyColumnStyles = {
  anomalyType: { width: "18%", minWidth: "190px" },
  affectedRecord: { width: "16%", minWidth: "170px" },
  disasterEvent: { width: "16%", minWidth: "180px" },
  whyFlagged: { width: "25%", minWidth: "300px" },
  reviewStatus: { width: "13%", minWidth: "150px" },
  detectedAt: { width: "10%", minWidth: "150px" },
  action: { width: "10%", minWidth: "136px", textAlign: "center", whiteSpace: "nowrap" },
};

const mswdoAnomalyColumnStyles = {
  severity: { width: "8%", minWidth: "104px" },
  anomalyType: { width: "18%", minWidth: "190px" },
  barangay: { width: "13%", minWidth: "150px" },
  affectedRecord: { width: "17%", minWidth: "185px" },
  disasterEvent: { width: "15%", minWidth: "170px" },
  status: { width: "13%", minWidth: "160px" },
  createdDate: { width: "10%", minWidth: "150px" },
  action: { width: "6%", minWidth: "88px", textAlign: "center", whiteSpace: "nowrap" },
};

const reviewButtonStyles = {
  ...pageHeaderStyles.primaryButton,
  minHeight: "42px",
  padding: "10px 14px",
  borderRadius: "12px",
};

const viewButtonStyles = {
  minWidth: "42px",
  minHeight: "42px",
  padding: "10px",
  border: "1px solid #cfddeb",
  borderRadius: "12px",
  backgroundColor: "#f8fbfe",
  color: "#2f5f8f",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const nonReviewActionStyles = {
  color: "#5f7892",
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: 1.4,
};

const searchInputStyles = {
  ...inputStyles,
  paddingLeft: "44px",
  backgroundColor: "#ffffff",
};

const filterPopoverStyles = {
  title: {
    margin: "0 0 16px",
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
  },
};

const statusFilters = [
  { value: "all", label: "All review statuses" },
  { value: "needs_review", label: "Pending Review" },
  { value: "reviewed", label: "Resolved" },
  { value: "referred", label: "Resolved" },
  { value: "system_handled", label: "Automatically Handled" },
  { value: "sync_center", label: "Review in Sync Center" },
];

const mswdoStatusFilters = [
  { value: "all", label: "All statuses" },
  { value: "needs_review", label: "Open" },
  { value: "reviewed", label: "Reviewed / Result Recorded" },
  { value: "referred", label: "Referred" },
  { value: "system_handled", label: "Dismissed / Automatically Handled" },
  { value: "sync_center", label: "Sync Center Review" },
];

const orderOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const DEFAULT_PAGE_SIZE = 50;
const REVIEW_NOTE_MAX_LENGTH = 2000;
const BARANGAY_STALE_REVIEW_MESSAGE =
  "This anomaly is no longer available for review. Its underlying record may have changed or it may no longer require Barangay review.";
const MSWDO_STALE_REVIEW_MESSAGE =
  "This anomaly is no longer available for review. Its underlying record may have changed or it may no longer require MSWDO review.";
const pageSizeOptions = [25, 50, 100];

const modalStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
    gap: "16px",
  },
  card: {
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
    gap: "14px",
  },
  fieldStack: {
    display: "grid",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "5px",
    minWidth: 0,
  },
  fieldLabel: {
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    color: "#17324d",
    fontSize: "14px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  helperText: {
    margin: "6px 0 0",
    color: "#5f7892",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  fieldError: {
    margin: "6px 0 0",
    color: "#b23b47",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  alert: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #f2c2c8",
    backgroundColor: "#fdecef",
    color: "#8f2434",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
};

const statusPalette = {
  open: {
    backgroundColor: "#fff4dc",
    borderColor: "#f2d49a",
    color: "#8a5a00",
  },
  resolved: {
    backgroundColor: "#e8f7ee",
    borderColor: "#c3e8d0",
    color: "#0b7a3b",
  },
  failed: {
    backgroundColor: "#fdecec",
    borderColor: "#f5c2c7",
    color: "#b23b47",
  },
};

const severityPalette = {
  High: {
    backgroundColor: "#fdecef",
    borderColor: "#f2c2c8",
    color: "#a52c3b",
  },
  Medium: {
    backgroundColor: "#fff4dc",
    borderColor: "#f2d49a",
    color: "#8a5a00",
  },
  Low: {
    backgroundColor: "#eaf3fb",
    borderColor: "#c7dced",
    color: "#2d5f8b",
  },
};

const paginationStyles = {
  wrapper: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    marginTop: "18px",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pageText: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  resultText: {
    color: "#5f7892",
    fontSize: "14px",
    fontWeight: 600,
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "Not available";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatNullableValue = (value, fallback = "Not available") => {
  const normalizedValue = String(value || "").trim();

  return normalizedValue || fallback;
};

const formatEventLabel = (row) =>
  formatNullableValue(
    row?.disaster_event_title ||
      row?.disaster_event?.title ||
      row?.disasterEvent?.title,
  );

const formatAffectedRecord = (row, isBarangayScope = true) => {
  const familyHeadName = String(row?.family_head_name || "").trim();

  if (isBarangayScope) {
    return familyHeadName || "Not identified";
  }

  const affectedRecordLabels = {
    SUSPICIOUS_DISTRIBUTION_ACTIVITY: familyHeadName
      ? `${familyHeadName} household distribution`
      : "Distribution record",
    SYNC_FAILED: familyHeadName
      ? `${familyHeadName} synchronization record`
      : "Synchronization record",
    SYNC_CONFLICT: familyHeadName
      ? `${familyHeadName} synchronization record`
      : "Synchronization record",
    DUPLICATE_CLAIM_ATTEMPT: familyHeadName
      ? `${familyHeadName} relief claim`
      : "Relief claim record",
    DUPLICATE_HOUSEHOLD_REGISTRATION: familyHeadName
      ? `${familyHeadName} household`
      : "Household record",
    INVENTORY_DISTRIBUTION_MISMATCH: familyHeadName
      ? `${familyHeadName} distribution record`
      : "Inventory / distribution record",
    FAILED_STUB_OR_QR_VERIFICATION: familyHeadName
      ? `${familyHeadName} stub or QR record`
      : "Stub or QR record",
  };

  return affectedRecordLabels[row?.anomaly_type] || familyHeadName || "Operational record";
};

const formatBarangayLabel = (row) =>
  formatNullableValue(row?.barangay_name, "Not attributed");

const normalizeBarangayName = (value) => String(value || "").trim().toLowerCase();

const mergeUniqueEvents = (...eventGroups) => {
  const eventMap = new Map();

  eventGroups.flat().forEach((event) => {
    if (!event?.id || eventMap.has(String(event.id))) {
      return;
    }

    eventMap.set(String(event.id), event);
  });

  return [...eventMap.values()];
};

const getEventBarangayScope = (event) => {
  const ids = new Set();
  const names = new Set();

  const addBarangay = (barangay) => {
    if (!barangay) {
      return;
    }

    if (typeof barangay === "object") {
      if (barangay.id) {
        ids.add(String(barangay.id));
      }

      if (barangay.barangay_id) {
        ids.add(String(barangay.barangay_id));
      }

      if (barangay.name) {
        names.add(normalizeBarangayName(barangay.name));
      }

      if (barangay.barangay_name) {
        names.add(normalizeBarangayName(barangay.barangay_name));
      }

      return;
    }

    ids.add(String(barangay));
    names.add(normalizeBarangayName(barangay));
  };

  const addBarangayNamesFromText = (value) => {
    if (!value || /all barangays/i.test(String(value))) {
      return;
    }

    String(value)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => names.add(normalizeBarangayName(name)));
  };

  [
    event?.affected_barangays,
    event?.affectedBarangays,
    event?.barangays,
    event?.affected_barangay_ids,
    event?.affectedBarangayIds,
    event?.barangay_ids,
  ].forEach((collection) => {
    if (Array.isArray(collection)) {
      collection.forEach(addBarangay);
    }
  });

  [
    event?.affected_barangays_text,
    event?.affectedBarangaysText,
    event?.affected_barangay_names,
    event?.affectedBarangayNames,
  ].forEach(addBarangayNamesFromText);

  return { ids, names };
};

const isBarangayInEventScope = (barangay, scope) => {
  if (!scope || (scope.ids.size === 0 && scope.names.size === 0)) {
    return true;
  }

  return (
    scope.ids.has(String(barangay.id)) ||
    scope.names.has(normalizeBarangayName(barangay.name))
  );
};

const getStatusCategory = (row) => {
  const reviewState = String(row?.review_state || "").toLowerCase();

  if (row?.review_status) {
    return "resolved";
  }

  if (reviewState === "reviewed" || reviewState === "referred" || reviewState === "system_handled") {
    return "resolved";
  }

  if (reviewState === "sync_center") {
    return "failed";
  }

  const status = String(row?.status || "").toUpperCase();
  const resolution = String(row?.resolution_status || "").toUpperCase();

  if (status === "FAILED" || status === "ERROR") {
    return "failed";
  }

  if (status === "OPEN" || resolution.includes("PENDING") || resolution.includes("RECOMMENDED")) {
    return "open";
  }

  return "resolved";
};

const isManualReviewableAnomaly = (row) => row?.manual_review_allowed === true;

const getStatusLabel = (row, scope = "barangay") => {
  if (scope === "barangay") {
    if (isManualReviewableAnomaly(row)) {
      return row?.review_status ? "Resolved" : "Pending Review";
    }

    if (
      row?.review_state === "sync_center" ||
      row?.anomaly_type === "SYNC_CONFLICT" ||
      row?.anomaly_type === "SYNC_FAILED"
    ) {
      return "Sync Center";
    }

    return "Automatically Handled";
  }

  const reviewLabel = getAnomalyReviewStateLabel(row, scope);

  if (reviewLabel) {
    return reviewLabel;
  }

  if (scope === "mswdo") {
    return getStatusCategory(row) === "failed" ? "Sync Center Review" : "Open";
  }

  return getStatusCategory(row) === "failed" ? "Sync Retry Needed" : "Needs Review";
};

const getAnomalyRowActionLabel = (row) => {
  if (isManualReviewableAnomaly(row)) {
    return "Review";
  }

  if (
    row?.review_state === "sync_center" ||
    row?.anomaly_type === "SYNC_CONFLICT" ||
    row?.anomaly_type === "SYNC_FAILED"
  ) {
    return "Sync Center";
  }

  return "No review needed";
};

const StatusPill = ({ row, scope = "barangay" }) => {
  const category = getStatusCategory(row);
  const palette = statusPalette[category] || statusPalette.open;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${palette.borderColor}`,
        backgroundColor: palette.backgroundColor,
        color: palette.color,
        fontSize: "12px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {getStatusLabel(row, scope)}
    </span>
  );
};

const SeverityPill = ({ row }) => {
  const severity = getAnomalySeverity(row);
  const palette = severityPalette[severity] || severityPalette.Medium;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${palette.borderColor}`,
        backgroundColor: palette.backgroundColor,
        color: palette.color,
        fontSize: "12px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {severity}
    </span>
  );
};

const DetailField = ({ label, children }) => (
  <div style={modalStyles.field}>
    <div style={modalStyles.fieldLabel}>{label}</div>
    <div style={modalStyles.value}>{children}</div>
  </div>
);

const modalPanelStyles = {
  maxHeight: "calc(100vh - 32px)",
  display: "flex",
  flexDirection: "column",
  overflowY: "hidden",
  overflowX: "hidden",
  borderRadius: "20px",
  padding: "20px",
};

const modalBodyStyles = {
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: "4px",
};

const modalFooterStyles = {
  marginTop: "16px",
  paddingTop: "14px",
  borderTop: "1px solid #e0eaf4",
  flexShrink: 0,
};

const getNormalizedReviewNote = (value) => String(value || "").trim();

const AnomalyDetailModal = ({
  anomaly,
  onClose,
  finalFocusRef,
  isBarangayScope,
  onReviewSaved,
  onReviewStale,
}) => {
  const [localReview, setLocalReview] = useState(null);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [reviewErrors, setReviewErrors] = useState({});
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [isReviewUnavailable, setIsReviewUnavailable] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const outcomeFieldRef = useRef(null);
  const noteFieldRef = useRef(null);

  useEffect(() => {
    setLocalReview(null);
    setIsEditingReview(false);
    setReviewStatus(anomaly?.review_status || "");
    setResolutionReason(anomaly?.resolution_reason || "");
    setReviewErrors({});
    setReviewSubmitError("");
    setIsReviewUnavailable(false);
  }, [anomaly]);

  if (!anomaly) {
    return null;
  }

  const presentationScope = isBarangayScope ? "barangay" : "mswdo";
  const presentation = getAnomalyPresentation(
    anomaly.anomaly_type,
    presentationScope,
  );
  const availableReviewOutcomeOptions = isBarangayScope
    ? reviewOutcomeOptions
    : mswdoReviewOutcomeOptions;
  const displayedAnomaly = localReview
    ? {
        ...anomaly,
        review_id: localReview.id || anomaly.review_id,
        review_status: localReview.review_status,
        resolution_reason: localReview.resolution_reason,
        reviewed_by: localReview.reviewed_by,
        reviewed_at: localReview.reviewed_at,
        reviewer_name: localReview.reviewer_name || anomaly.reviewer_name,
        review_state:
          localReview.review_status === "REFERRED" ? "referred" : "reviewed",
        manual_review_allowed: anomaly.manual_review_allowed,
      }
    : anomaly;
  const hasSavedReview = Boolean(displayedAnomaly.review_status);
  const isSyncAnomaly = anomaly.anomaly_type === "SYNC_CONFLICT" || anomaly.anomaly_type === "SYNC_FAILED";
  const canRecordReview =
    anomaly.manual_review_allowed === true &&
    (isBarangayScope || Boolean(anomaly.barangay_id)) &&
    !isReviewUnavailable;
  const needsBarangayAttribution =
    !isBarangayScope &&
    displayedAnomaly.review_state === "needs_review" &&
    !displayedAnomaly.barangay_id;
  const shouldShowReviewForm =
    canRecordReview && (!hasSavedReview || (!isBarangayScope && isEditingReview));
  const originalReviewStatus = hasSavedReview ? displayedAnomaly.review_status || "" : "";
  const originalReviewNote = hasSavedReview
    ? getNormalizedReviewNote(displayedAnomaly.resolution_reason)
    : "";
  const currentReviewNote = getNormalizedReviewNote(resolutionReason);
  const reviewHasChanges =
    hasSavedReview
      ? reviewStatus !== originalReviewStatus ||
        currentReviewNote !== originalReviewNote
      : isBarangayScope || Boolean(reviewStatus || currentReviewNote);
  const isSaveDisabled =
    isSubmittingReview ||
    !reviewHasChanges;
  const reviewOutcomeErrorId = "anomaly-review-outcome-error";
  const reviewOutcomeHelperId = "anomaly-review-outcome-helper";
  const reviewNoteErrorId = "anomaly-review-note-error";
  const reviewNoteHelperId = "anomaly-review-note-helper";

  const validateReviewForm = () => {
    const nextErrors = {};
    const trimmedReason = getNormalizedReviewNote(resolutionReason);

    if (!reviewStatus) {
      nextErrors.reviewStatus = "Please select a review outcome.";
    }

    if (!trimmedReason) {
      nextErrors.resolutionReason = "Please enter a brief review note.";
    } else if (trimmedReason.length > REVIEW_NOTE_MAX_LENGTH) {
      nextErrors.resolutionReason = `Review note must be ${REVIEW_NOTE_MAX_LENGTH} characters or fewer.`;
    }

    setReviewErrors(nextErrors);

    if (nextErrors.reviewStatus) {
      outcomeFieldRef.current?.focus?.();
    } else if (nextErrors.resolutionReason) {
      noteFieldRef.current?.focus?.();
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (isSubmittingReview) {
      return;
    }

    const trimmedReason = getNormalizedReviewNote(resolutionReason);

    setReviewSubmitError("");

    if (!validateReviewForm()) {
      return;
    }

    if (hasSavedReview && isEditingReview && !reviewHasChanges) {
      return;
    }

    try {
      setIsSubmittingReview(true);

      const response = await saveAnomalyReview({
        source_type: anomaly.source_type,
        source_id: anomaly.source_id,
        anomaly_type: anomaly.anomaly_type,
        review_status: reviewStatus,
        resolution_reason: trimmedReason,
      });

      setLocalReview(response?.data || null);
      setIsEditingReview(false);
      setReviewErrors({});
      setReviewSubmitError("");
      await onReviewSaved?.(response?.data || null);
    } catch (error) {
      if (error.code === "ANOMALY_REVIEW_BARANGAY_REQUIRED") {
        setIsReviewUnavailable(true);
        setReviewSubmitError(
          "Affected Barangay information must be identified before MSWDO can record a review result.",
        );
        await onReviewStale?.();
        return;
      }

      if (
        error.code === "ANOMALY_REVIEW_UNAVAILABLE" ||
        error.code === "ANOMALY_REVIEW_NOT_ALLOWED" ||
        error.statusCode === 404 ||
        error.statusCode === 409
      ) {
        setIsReviewUnavailable(true);
        setReviewSubmitError(
          isBarangayScope
            ? BARANGAY_STALE_REVIEW_MESSAGE
            : MSWDO_STALE_REVIEW_MESSAGE,
        );
        await onReviewStale?.();
        return;
      }

      setReviewSubmitError(
        "Review could not be saved. Your entered information has been kept. Please try again.",
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const startEditingReview = () => {
    setIsEditingReview(true);
    setReviewStatus(displayedAnomaly.review_status || "");
    setResolutionReason(displayedAnomaly.resolution_reason || "");
    setReviewErrors({});
    setReviewSubmitError("");
  };

  const cancelReviewEdit = () => {
    if (hasSavedReview) {
      setIsEditingReview(false);
      setReviewStatus(displayedAnomaly.review_status || "");
      setResolutionReason(displayedAnomaly.resolution_reason || "");
      setReviewErrors({});
      setReviewSubmitError("");
      return;
    }

    onClose();
  };

  const modalFooter = shouldShowReviewForm ? (
    <>
      <button type="button" onClick={cancelReviewEdit} style={pageHeaderStyles.secondaryButton}>
        Cancel
      </button>
      <button
        type="submit"
        form="anomaly-review-form"
        disabled={isSaveDisabled}
        aria-busy={isSubmittingReview}
        style={pageHeaderStyles.primaryButton}
      >
        {isSubmittingReview
          ? "Saving..."
          : hasSavedReview
            ? isBarangayScope
              ? "Save Changes"
              : "Save Result Changes"
            : isBarangayScope
              ? "Save Review"
              : "Save Result"}
      </button>
    </>
  ) : !isBarangayScope && canRecordReview && hasSavedReview ? (
    <>
      <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
        Close
      </button>
      <button type="button" onClick={startEditingReview} style={pageHeaderStyles.primaryButton}>
        Edit Result
      </button>
    </>
  ) : (
    <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
      Close
    </button>
  );

  return (
    <FormModalShell
      isOpen
      title={isBarangayScope && !hasSavedReview ? "Review Anomaly" : "Anomaly Details"}
      onClose={onClose}
      closeButtonLabel="Close anomaly details"
      closeOnBackdrop={false}
      finalFocusRef={finalFocusRef}
      maxWidth="min(760px, 100vw)"
      overlayStyle={{ padding: "16px" }}
      contentStyle={modalPanelStyles}
      bodyStyle={modalBodyStyles}
      footerStyle={modalFooterStyles}
      footer={modalFooter}
    >
      <div style={{ ...modalStyles.card, marginBottom: "16px" }}>
        <div style={labelStyles}>Anomaly Type</div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ ...modalStyles.value, fontSize: "16px" }}>{presentation.label}</strong>
          <StatusPill row={displayedAnomaly} scope={presentationScope} />
        </div>
      </div>

      <div style={modalStyles.grid}>
        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>Context</div>
          <div style={modalStyles.fieldGrid}>
            <DetailField label="Disaster Event">
              {formatEventLabel(displayedAnomaly)}
            </DetailField>
            <DetailField label="Affected Record">
              {formatAffectedRecord(displayedAnomaly, isBarangayScope)}
            </DetailField>
            <DetailField label="Detected At">
              {formatDateTime(displayedAnomaly.occurred_at)}
            </DetailField>
            {!isBarangayScope ? (
              <DetailField label="Barangay">
                {formatBarangayLabel(displayedAnomaly)}
              </DetailField>
            ) : null}
          </div>
        </div>

        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>Why Flagged</div>
          <div style={modalStyles.value}>
            {getAnomalyExplanation(displayedAnomaly, presentationScope)}
          </div>
        </div>

        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>Recommended Action</div>
          <div style={modalStyles.fieldStack}>
            <DetailField label="Recommendation">
              {getAnomalyActionSummary(displayedAnomaly, presentationScope)}
            </DetailField>
            <DetailField label="Responsible Office">
              {getAnomalyOwner(displayedAnomaly, presentationScope)}
            </DetailField>
          </div>
        </div>

        {isSyncAnomaly ? (
          <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
            <div style={labelStyles}>Related Information</div>
            <div style={modalStyles.value}>
              {isBarangayScope
                ? "This item is primarily handled in Sync Center. Review the local queue, server history, and conflict details there before taking operational action."
                : "This synchronization issue is shown here for consolidated monitoring. Sync Center remains responsible for synchronization operations, recovery, and conflict handling."}
            </div>
          </div>
        ) : null}

        {hasSavedReview ? (
          <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
            <div style={labelStyles}>Review Result</div>
            <div style={modalStyles.fieldGrid}>
              <DetailField label="Outcome">
                {formatReviewOutcome(
                  displayedAnomaly.review_status,
                  presentationScope,
                )}
              </DetailField>
              {isBarangayScope ? (
                <DetailField label="Reviewed By">
                  {displayedAnomaly.reviewer_name || "Not available"}
                </DetailField>
              ) : null}
              <DetailField label="Reviewed At">
                {formatDateTime(displayedAnomaly.reviewed_at)}
              </DetailField>
              <DetailField label={isBarangayScope ? "Review Note" : "Resolution Note"}>
                {displayedAnomaly.resolution_reason || "Not available"}
              </DetailField>
            </div>
          </div>
        ) : null}

        {!canRecordReview && isBarangayScope && displayedAnomaly.review_state === "system_handled" ? (
          <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
            <div style={labelStyles}>Resolution</div>
            <div style={modalStyles.value}>
              Automatically handled by DISTYNC. No separate Barangay anomaly review is required.
            </div>
          </div>
        ) : null}

        {needsBarangayAttribution ? (
          <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
            <div style={labelStyles}>Review Availability</div>
            <div style={modalStyles.value}>
              Affected Barangay information must be identified before MSWDO can record a review result.
            </div>
          </div>
        ) : null}

        {reviewSubmitError ? (
          <div
            role="alert"
            aria-live="assertive"
            style={{ ...modalStyles.alert, gridColumn: "1 / -1" }}
          >
            {reviewSubmitError}
          </div>
        ) : null}

        {shouldShowReviewForm ? (
          <form
            id="anomaly-review-form"
            onSubmit={handleReviewSubmit}
            noValidate
            style={{ ...modalStyles.card, gridColumn: "1 / -1", padding: "14px" }}
          >
            <fieldset
              ref={outcomeFieldRef}
              tabIndex={-1}
              style={{
                margin: 0,
                padding: 0,
                border: 0,
                display: "grid",
                gap: "8px",
              }}
              aria-describedby={[
                reviewOutcomeHelperId,
                reviewErrors.reviewStatus ? reviewOutcomeErrorId : "",
              ].filter(Boolean).join(" ")}
              aria-invalid={Boolean(reviewErrors.reviewStatus)}
            >
              <legend style={labelStyles}>
                {hasSavedReview
                  ? "Edit Result"
                  : isBarangayScope
                    ? "Record Review"
                    : "Record Result"}
              </legend>
              <div style={{ ...labelStyles, marginBottom: 0 }}>
                {isBarangayScope ? "Review Outcome *" : "Validation Result *"}
              </div>
              <p id={reviewOutcomeHelperId} style={modalStyles.helperText}>
                {isBarangayScope
                  ? "Select the result that best matches your verification."
                  : "Select the result that best documents MSWDO validation."}
              </p>
              <div style={{ display: "grid", gap: "8px", marginBottom: "10px" }}>
                {availableReviewOutcomeOptions.map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      alignItems: "flex-start",
                      gap: "9px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border:
                        reviewStatus === option.value
                          ? "2px solid #2f7d59"
                          : "1px solid #cfddeb",
                      backgroundColor:
                        reviewStatus === option.value ? "#eef8f2" : "#ffffff",
                      color: "#17324d",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="review_status"
                      value={option.value}
                      checked={reviewStatus === option.value}
                      onChange={(event) => {
                        setReviewStatus(event.target.value);
                        setReviewErrors((currentErrors) => ({
                          ...currentErrors,
                          reviewStatus: "",
                        }));
                        setReviewSubmitError("");
                      }}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <br />
                      <span style={{ color: "#5f7892", fontSize: "13px", lineHeight: 1.35 }}>
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {reviewErrors.reviewStatus ? (
                <p id={reviewOutcomeErrorId} role="alert" style={modalStyles.fieldError}>
                  {reviewErrors.reviewStatus}
                </p>
              ) : null}
            </fieldset>

            <label htmlFor="anomaly-review-note" style={labelStyles}>
              {isBarangayScope ? "Review Note *" : "Resolution Note *"}
            </label>
            <p id={reviewNoteHelperId} style={modalStyles.helperText}>
              {isBarangayScope
                ? "Briefly describe what you verified and why you selected this outcome."
                : "Document what MSWDO validated, coordinated, or referred and why this result was selected."}
            </p>
            <textarea
              id="anomaly-review-note"
              ref={noteFieldRef}
              value={resolutionReason}
              onChange={(event) => {
                setResolutionReason(event.target.value);
                setReviewErrors((currentErrors) => ({
                  ...currentErrors,
                  resolutionReason: "",
                }));
                setReviewSubmitError("");
              }}
              rows={3}
              aria-required="true"
              aria-invalid={Boolean(reviewErrors.resolutionReason)}
              aria-describedby={[
                reviewNoteHelperId,
                reviewErrors.resolutionReason ? reviewNoteErrorId : "",
              ].filter(Boolean).join(" ")}
              style={{ ...inputStyles, resize: "vertical", lineHeight: 1.5, minHeight: "86px" }}
            />
            {reviewErrors.resolutionReason ? (
              <p id={reviewNoteErrorId} role="alert" style={modalStyles.fieldError}>
                {reviewErrors.resolutionReason}
              </p>
            ) : null}
          </form>
        ) : null}

      </div>
    </FormModalShell>
  );
};

const AnomalyTrackingPage = ({
  scope = "mswdo",
  assignedBarangay = null,
  assignedBarangayId = "",
  scopedDisasterEvents = [],
  scopeErrorMessage = "",
}) => {
  const isBarangayScope = scope === "barangay";
  const presentationScope = isBarangayScope ? "barangay" : "mswdo";
  const availableStatusFilters = isBarangayScope
    ? statusFilters
    : mswdoStatusFilters;
  const availableAnomalyTypes = useMemo(
    () => getAnomalyTypesForScope(scope),
    [scope],
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    date_from: "",
    date_to: "",
  });
  const [viewState, setViewState] = useState({
    search: "",
    anomaly_type: "all",
    status: "all",
    order: "newest",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const anomalyDetailsTriggerRef = useRef(null);
  const anomalyRecordsHeadingRef = useRef(null);
  const anomalyDetailsFinalFocusRef = useMemo(
    () => ({
      get current() {
        const triggerElement = anomalyDetailsTriggerRef.current;

        if (triggerElement?.isConnected && typeof triggerElement.focus === "function") {
          return triggerElement;
        }

        const fallbackElement = anomalyRecordsHeadingRef.current;

        if (fallbackElement?.isConnected && typeof fallbackElement.focus === "function") {
          return fallbackElement;
        }

        return null;
      },
    }),
    [],
  );

  const updateFilters = (updater) => {
    setPage(1);
    setFilters(updater);
  };

  const updateViewState = (updater) => {
    setPage(1);
    setViewState(updater);
  };

  const resolvedAssignedBarangay = useMemo(() => {
    if (!isBarangayScope) {
      return null;
    }

    if (assignedBarangay?.id) {
      return assignedBarangay;
    }

    const matchingBarangay = barangays.find(
      (barangay) => String(barangay.id) === String(assignedBarangayId),
    );

    if (matchingBarangay) {
      return matchingBarangay;
    }

    return assignedBarangayId ? { id: assignedBarangayId, name: "" } : null;
  }, [assignedBarangay, assignedBarangayId, barangays, isBarangayScope]);

  const scopedBarangays = useMemo(() => {
    if (!isBarangayScope) {
      return barangays;
    }

    return resolvedAssignedBarangay ? [resolvedAssignedBarangay] : [];
  }, [barangays, isBarangayScope, resolvedAssignedBarangay]);

  const availableDisasterEvents = useMemo(() => {
    if (!isBarangayScope) {
      return disasterEvents;
    }

    return mergeUniqueEvents(disasterEvents, scopedDisasterEvents);
  }, [disasterEvents, isBarangayScope, scopedDisasterEvents]);

  const selectedDisasterEvent = useMemo(
    () =>
      availableDisasterEvents.find(
        (event) => String(event.id) === String(filters.disaster_event_id),
      ) || null,
    [availableDisasterEvents, filters.disaster_event_id],
  );

  const availableBarangays = useMemo(() => {
    if (!selectedDisasterEvent) {
      return scopedBarangays;
    }

    const eventBarangayScope = getEventBarangayScope(selectedDisasterEvent);
    return scopedBarangays.filter((barangay) =>
      isBarangayInEventScope(barangay, eventBarangayScope),
    );
  }, [scopedBarangays, selectedDisasterEvent]);

  useEffect(() => {
    if (!isBarangayScope) {
      return;
    }

    setPage(1);
    setFilters((currentValue) => {
      const nextBarangayId = resolvedAssignedBarangay?.id || "";

      if (currentValue.barangay_id === nextBarangayId) {
        return currentValue;
      }

      return {
        ...currentValue,
        barangay_id: nextBarangayId,
      };
    });
  }, [isBarangayScope, resolvedAssignedBarangay?.id]);

  useEffect(() => {
    if (!isBarangayScope || !filters.disaster_event_id) {
      return;
    }

    const selectedEventIsAvailable = availableDisasterEvents.some(
      (event) => String(event.id) === String(filters.disaster_event_id),
    );

    if (selectedEventIsAvailable) {
      return;
    }

    setPage(1);
    setFilters((currentValue) => ({
      ...currentValue,
      disaster_event_id: "",
      barangay_id: resolvedAssignedBarangay?.id || "",
    }));
  }, [
    availableDisasterEvents,
    filters.disaster_event_id,
    isBarangayScope,
    resolvedAssignedBarangay?.id,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoadingFilters(true);

      try {
        const [eventRows, barangayRows] = await Promise.all([
          isBarangayScope
            ? fetchBarangayDisasterEventOptions()
            : fetchAllDisasterEvents(),
          fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
        setBarangays(Array.isArray(barangayRows) ? barangayRows : []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Failed to load anomaly filters.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, [isBarangayScope]);

  useEffect(() => {
    let isMounted = true;

    const loadRows = async () => {
      if (isBarangayScope && !resolvedAssignedBarangay?.id) {
        setRows([]);
        setPagination({
          page,
          pageSize,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        });
        setErrorMessage(
          scopeErrorMessage || "No assigned barangay. Please contact administrator.",
        );
        setIsLoadingRows(false);
        return;
      }

      setIsLoadingRows(true);
      setErrorMessage("");

      try {
        const response = await fetchMswdoAnomalies({
          ...filters,
          barangay_id: isBarangayScope
            ? resolvedAssignedBarangay.id
            : filters.barangay_id,
          anomaly_type: viewState.anomaly_type === "all" ? "" : viewState.anomaly_type,
          review_state: viewState.status === "all" ? "" : viewState.status,
          search: viewState.search.trim(),
          order: viewState.order,
          page,
          pageSize,
        });

        if (!isMounted) {
          return;
        }

        setRows(Array.isArray(response.data) ? response.data : []);
        setPagination(
          response.pagination || {
            page,
            pageSize,
            totalItems: Array.isArray(response.data) ? response.data.length : 0,
            totalPages: Array.isArray(response.data) && response.data.length ? 1 : 0,
            hasPreviousPage: page > 1,
            hasNextPage: false,
          },
        );
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setPagination({
            page,
            pageSize,
            totalItems: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          });
          setErrorMessage(error.message || "Failed to load anomalies.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingRows(false);
        }
      }
    };

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [
    filters,
    isBarangayScope,
    page,
    pageSize,
    reloadToken,
    resolvedAssignedBarangay?.id,
    scopeErrorMessage,
    viewState,
  ]);

  const summary = useMemo(() => {
    return rows.reduce(
      (currentSummary, row) => {
        currentSummary.total += 1;

        const category = getStatusCategory(row);

        if (category === "open") {
          currentSummary.open += 1;
        }

        if (category === "failed") {
          currentSummary.failed += 1;
        }

        if (category === "resolved") {
          currentSummary.resolved += 1;
        }

        return currentSummary;
      },
      {
        total: 0,
        open: 0,
        failed: 0,
        resolved: 0,
      },
    );
  }, [rows]);

  const hasActiveFilters = Boolean(
    filters.disaster_event_id ||
      (filters.barangay_id && !isBarangayScope) ||
      filters.date_from ||
      filters.date_to ||
      viewState.search.trim() ||
      viewState.anomaly_type !== "all" ||
      viewState.status !== "all",
  );
  const totalItems = pagination.totalItems || 0;
  const totalPages = pagination.totalPages || 0;
  const firstVisibleItem = totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastVisibleItem = totalItems === 0
    ? 0
    : Math.min(firstVisibleItem + rows.length - 1, totalItems);
  const shouldShowPaginationControls = totalItems > 0;
  const openAnomalyDetails = useCallback((row, event) => {
    anomalyDetailsTriggerRef.current = event.currentTarget;
    setSelectedAnomaly(row);
  }, []);
  const closeAnomalyDetails = useCallback(() => {
    setSelectedAnomaly(null);
  }, []);
  const paginationControls = shouldShowPaginationControls ? (
    <div style={paginationStyles.wrapper}>
      <div style={paginationStyles.controls}>
        <button
          type="button"
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          disabled={!pagination.hasPreviousPage || isLoadingRows}
          style={pageHeaderStyles.secondaryButton}
        >
          Previous
        </button>
        <span style={paginationStyles.pageText}>
          Page {pagination.page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((currentPage) => currentPage + 1)}
          disabled={!pagination.hasNextPage || isLoadingRows}
          style={pageHeaderStyles.secondaryButton}
        >
          Next
        </button>
      </div>

      <label style={{ ...paginationStyles.controls, color: "#17324d", fontWeight: 700 }}>
        Rows per page
        <select
          value={pageSize}
          onChange={(event) => {
            setPage(1);
            setPageSize(Number(event.target.value));
          }}
          style={{
            minWidth: "92px",
            borderRadius: "12px",
            border: "1px solid #c7d6e5",
            backgroundColor: "#ffffff",
            color: "#17324d",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  ) : null;

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader
        title={isBarangayScope ? "Anomaly Tracking" : "Anomaly Tracking Management"}
        description={
          isBarangayScope
            ? ""
            : "Review and coordinate operational inconsistencies reported across all Barangays in the municipality."
        }
        actions={[]}
      />

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.filterGrid}>
          <div>
            <label htmlFor="anomaly-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="anomaly-event"
              value={filters.disaster_event_id}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  disaster_event_id: event.target.value,
                  barangay_id: isBarangayScope
                    ? resolvedAssignedBarangay?.id || ""
                    : "",
                }))
              }
              disabled={isLoadingFilters}
              style={inputStyles}
            >
              <option value="">All disaster events</option>
              {availableDisasterEvents.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </div>

          {!isBarangayScope ? (
            <div>
              <label htmlFor="anomaly-barangay" style={labelStyles}>
                Barangay
              </label>
              <select
                id="anomaly-barangay"
                value={filters.barangay_id}
                onChange={(event) =>
                  updateFilters((currentValue) => ({
                    ...currentValue,
                    barangay_id: event.target.value,
                  }))
                }
                disabled={isLoadingFilters}
                style={inputStyles}
              >
                <option value="">All Barangays</option>
                {availableBarangays.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="anomaly-type" style={labelStyles}>
              Anomaly Type
            </label>
            <select
              id="anomaly-type"
              value={viewState.anomaly_type}
              onChange={(event) =>
                updateViewState((currentValue) => ({
                  ...currentValue,
                  anomaly_type: event.target.value,
                }))
              }
              style={inputStyles}
            >
              {availableAnomalyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="anomaly-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="anomaly-date-from"
              type="date"
              value={filters.date_from}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_from: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="anomaly-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="anomaly-date-to"
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_to: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>
        </div>
      </section>

      {!isBarangayScope ? (
        <div style={shellStyles.statGrid}>
          <StatusCard label="Total Detected" value={totalItems} />
          <StatusCard label="Open on Page" value={summary.open} />
          <StatusCard label="Sync Center Items on Page" value={summary.failed} />
          <StatusCard label="Reviewed / Dismissed on Page" value={summary.resolved} />
        </div>
      ) : null}

      <div style={pageSpacingStyles.toolbar}>
        <div style={{ position: "relative", flex: "1 1 420px", minWidth: "260px" }}>
          <FiSearch
            size={18}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#6f8aa6",
            }}
          />
          <input
            type="search"
            value={viewState.search}
            onChange={(event) =>
              updateViewState((currentValue) => ({
                ...currentValue,
                search: event.target.value,
              }))
            }
            placeholder={
              isBarangayScope
                ? "Search anomaly type, family head, barangay, event, or reason"
                : "Search anomaly type, Barangay, affected record, event, status, or notes"
            }
            aria-label="Search anomaly records"
            style={searchInputStyles}
          />
        </div>

        <div style={pageSpacingStyles.actionGroup}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#17324d",
              fontWeight: 700,
            }}
          >
              <label
              htmlFor="anomaly-status"
              style={{ margin: 0, fontSize: "14px" }}
            >
              {isBarangayScope ? "Review Status" : "Status"}
            </label>
            <select
              id="anomaly-status"
              value={viewState.status}
              onChange={(event) =>
                updateViewState((currentValue) => ({
                  ...currentValue,
                  status: event.target.value,
                }))
              }
              style={{
                minWidth: "120px",
                borderRadius: "12px",
                border: "1px solid #c7d6e5",
                backgroundColor: "#ffffff",
                color: "#17324d",
                padding: "10px 12px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {availableStatusFilters.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <ResponsiveFilterPopover
              isOpen={isFilterOpen}
              onOpenChange={setIsFilterOpen}
              title="Filter Records"
              trigger={({ ref, ...triggerProps }) => (
                <button
                  ref={ref}
                  type="button"
                  style={{
                    ...pageHeaderStyles.secondaryButton,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                  {...triggerProps}
                >
                  <FiFilter size={18} />
                  Filter
                </button>
              )}
            >
                <h3 style={filterPopoverStyles.title}>Filter Records</h3>
                <label htmlFor="anomaly-order" style={labelStyles}>
                  Order List
                </label>
                <select
                  id="anomaly-order"
                  value={viewState.order}
                  onChange={(event) =>
                    updateViewState((currentValue) => ({
                      ...currentValue,
                      order: event.target.value,
                    }))
                  }
                  style={inputStyles}
                >
                  {orderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
            </ResponsiveFilterPopover>
          </div>
        </div>
      </div>

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.tableHeader}>
          <h3
            ref={anomalyRecordsHeadingRef}
            tabIndex={-1}
            style={{ margin: 0, color: "#17324d", outline: "none" }}
          >
            Anomaly Records
          </h3>
          <span style={paginationStyles.resultText}>
            {totalItems === 0
              ? "No anomalies found"
              : `Showing ${firstVisibleItem}-${lastVisibleItem} of ${totalItems}`}
          </span>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading anomaly tracking..." />
        ) : rows.length === 0 ? (
          <EmptyState
            message={
              hasActiveFilters
                ? "No anomalies found for the current filters."
                : "No unusual or inconsistent records currently require review."
            }
          />
        ) : (
          <>
            <div style={{ overflowX: "auto", width: "100%", minWidth: 0 }}>
              <table
                style={{
                  ...tableStyles.table,
                  minWidth: isBarangayScope
                    ? barangayAnomalyTableMinWidth
                    : mswdoAnomalyTableMinWidth,
                }}
              >
                <thead>
                  {isBarangayScope ? (
                    <tr>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.anomalyType }}>Anomaly Type</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.affectedRecord }}>Affected Record</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.disasterEvent }}>Disaster Event</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.whyFlagged }}>Why Flagged</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.reviewStatus }}>Review Status</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.detectedAt }}>Detected At</th>
                      <th style={{ ...tableStyles.th, ...barangayAnomalyColumnStyles.action }}>Action</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.severity }}>Severity</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.anomalyType }}>Anomaly Type</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.barangay }}>Barangay</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.affectedRecord }}>Affected Record</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.disasterEvent }}>Disaster Event</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.status }}>Status</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.createdDate }}>Created Date</th>
                      <th style={{ ...tableStyles.th, ...mswdoAnomalyColumnStyles.action }}>Action</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={`${row.anomaly_type}-${row.reference_id || "no-reference"}-${
                        row.source_type || "no-source"
                      }-${row.source_id || row.occurred_at || rowIndex}`}
                    >
                      {isBarangayScope ? (
                        <>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.anomalyType }}>
                            <span style={{ fontWeight: 700 }}>
                              {formatAnomalyType(row.anomaly_type, presentationScope)}
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.affectedRecord }}>
                            {formatAffectedRecord(row, true)}
                          </td>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.disasterEvent }}>
                            {formatEventLabel(row)}
                          </td>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.whyFlagged }}>
                            {getAnomalyExplanation(row, presentationScope)}
                          </td>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.reviewStatus }}>
                            <StatusPill row={row} scope={presentationScope} />
                          </td>
                          <td style={{ ...tableStyles.td, ...barangayAnomalyColumnStyles.detectedAt }}>
                            {formatDateTime(row.occurred_at)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.severity }}>
                            <SeverityPill row={row} />
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.anomalyType }}>
                            <span style={{ fontWeight: 700 }}>
                              {formatAnomalyType(row.anomaly_type, presentationScope)}
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.barangay }}>
                            {formatBarangayLabel(row)}
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.affectedRecord }}>
                            {formatAffectedRecord(row, false)}
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.disasterEvent }}>
                            {formatEventLabel(row)}
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.status }}>
                            <StatusPill row={row} scope={presentationScope} />
                          </td>
                          <td style={{ ...tableStyles.td, ...mswdoAnomalyColumnStyles.createdDate }}>
                            {formatDateTime(row.occurred_at)}
                          </td>
                        </>
                      )}
                      <td
                        style={{
                          ...tableStyles.td,
                          ...(isBarangayScope
                            ? barangayAnomalyColumnStyles.action
                            : mswdoAnomalyColumnStyles.action),
                        }}
                      >
                        {isBarangayScope && isManualReviewableAnomaly(row) && row.review_status ? (
                          <button
                            type="button"
                            onClick={(event) => openAnomalyDetails(row, event)}
                            aria-label="View anomaly details"
                            title="View anomaly details"
                            style={viewButtonStyles}
                          >
                            <FiEye size={18} aria-hidden="true" />
                          </button>
                        ) : isManualReviewableAnomaly(row) ? (
                          <button
                            type="button"
                            onClick={(event) => openAnomalyDetails(row, event)}
                            aria-label="Review anomaly"
                            title="Review anomaly"
                            style={reviewButtonStyles}
                          >
                            Review
                          </button>
                        ) : (
                          <span style={nonReviewActionStyles}>
                            {getAnomalyRowActionLabel(row)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginationControls}
          </>
        )}
      </section>

      <AnomalyDetailModal
        anomaly={selectedAnomaly}
        onClose={closeAnomalyDetails}
        finalFocusRef={anomalyDetailsFinalFocusRef}
        isBarangayScope={isBarangayScope}
        onReviewSaved={async () => {
          setReloadToken((currentValue) => currentValue + 1);
        }}
        onReviewStale={async () => {
          setReloadToken((currentValue) => currentValue + 1);
        }}
      />
    </div>
  );
};

export default AnomalyTrackingPage;
