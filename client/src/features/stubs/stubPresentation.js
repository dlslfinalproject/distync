import { LOCAL_SYNC_STATUS } from "../../offline/syncStatusConstants.js";

export const STUB_PRESENTATION_STATUSES = Object.freeze({
  FOR_CLAIM: "FOR_CLAIM",
  CLAIMED: "CLAIMED",
  NOT_PRESENT: "NOT_PRESENT",
});

export const STUB_STATUS_PRIORITY = Object.freeze({
  FOR_CLAIM: 1,
  CLAIMED: 2,
  NOT_PRESENT: 3,
});

const normalize = (value) => String(value || "").trim().toUpperCase();

const rowHouseholdIds = (row) =>
  [row?.household_id, row?.household?.id, row?.household_occurrence_id]
    .filter(Boolean)
    .map(String);

const entryHouseholdIds = (entry) =>
  [
    entry?.entityServerId,
    entry?.entityLocalId,
    entry?.householdId,
    entry?.householdOccurrenceId,
    entry?.payload?.household_id,
    entry?.payload?.household_occurrence_id,
    entry?.payload?.householdId,
  ]
    .filter(Boolean)
    .map(String);

const matchesScope = (entry, { disasterEventId = "", barangayId = "" } = {}) => {
  const payload = entry?.payload || {};
  return (
    (!disasterEventId || String(payload.disaster_event_id || "") === String(disasterEventId)) &&
    (!barangayId || String(entry?.barangayId || payload.barangay_id || "") === String(barangayId))
  );
};

export const hasPendingHouseholdDeparture = (row, syncEntries = [], scope = {}) => {
  const ids = new Set(rowHouseholdIds(row));
  return syncEntries.some((entry) =>
    entry?.actionKey === "HOUSEHOLD_DEPART" &&
    entry?.entityType === "HOUSEHOLD" &&
    matchesScope(entry, scope) &&
    ![LOCAL_SYNC_STATUS.SYNCED, LOCAL_SYNC_STATUS.CONFLICT].includes(entry?.status) &&
    entryHouseholdIds(entry).some((id) => ids.has(id)),
  );
};

export const isEffectivelyNotPresentStubRow = (row, syncEntries = [], scope = {}) => {
  const attendanceStatus = normalize(
    row?.latest_attendance_status ?? row?.latest_attendance?.status,
  );
  const timeOut = row?.latest_attendance_time_out ?? row?.latest_attendance?.time_out;

  return (
    row?.household?.is_active === false ||
    row?.is_active === false ||
    (attendanceStatus && (attendanceStatus !== "PRESENT" || Boolean(timeOut))) ||
    hasPendingHouseholdDeparture(row, syncEntries, scope)
  );
};

export const resolveStubPresentationStatus = (row, syncEntries = [], scope = {}) => {
  if (normalize(row?.status) === "CLAIMED") {
    return STUB_PRESENTATION_STATUSES.CLAIMED;
  }
  if (isEffectivelyNotPresentStubRow(row, syncEntries, scope)) {
    return STUB_PRESENTATION_STATUSES.NOT_PRESENT;
  }
  return STUB_PRESENTATION_STATUSES.FOR_CLAIM;
};

export const withStubPresentationStatus = (row, syncEntries = [], scope = {}) => ({
  ...row,
  presentation_status: resolveStubPresentationStatus(row, syncEntries, scope),
});

const numericSequence = (row) => {
  const canonical = Number(row?.stub_sequence_no);
  if (Number.isFinite(canonical)) return canonical;
  const display = String(row?.display_stub_no || row?.stub_number || row?.stub_no || "");
  const match = display.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

export const comparePresentedStubRows = (left, right) => {
  const priority =
    (STUB_STATUS_PRIORITY[left?.presentation_status] || 99) -
    (STUB_STATUS_PRIORITY[right?.presentation_status] || 99);
  if (priority) return priority;
  const sequence = numericSequence(left) - numericSequence(right);
  if (sequence) return sequence;
  const issued = new Date(left?.issued_at || 0).getTime() - new Date(right?.issued_at || 0).getTime();
  if (Number.isFinite(issued) && issued) return issued;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
};

export const sortPresentedStubRows = (rows = []) => [...rows].sort(comparePresentedStubRows);
