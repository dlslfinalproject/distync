import { buildSyncDescriptor } from "../../offline/syncStatus.js";

const normalizeAttendanceStatus = (value) =>
  String(value || "").trim().toUpperCase();

export const getStubPresenceState = (row) => {
  const attendanceStatus =
    row?.latest_attendance_status ?? row?.latest_attendance?.status;
  const attendanceTimeOut =
    row?.latest_attendance_time_out ?? row?.latest_attendance?.time_out;
  const normalizedStatus = normalizeAttendanceStatus(attendanceStatus);

  if (!normalizedStatus) {
    return attendanceTimeOut ? "ABSENT" : "UNKNOWN";
  }

  return normalizedStatus === "PRESENT" && !attendanceTimeOut
    ? "PRESENT"
    : "ABSENT";
};

export const isCurrentlyPresentStubRow = (row) =>
  getStubPresenceState(row) === "PRESENT";

const CLAIM_BLOCKING_SYNC_STATUSES = new Set([
  "PENDING",
  "FAILED",
  "CONFLICT",
  "SYNCED",
]);

export const getStubClaimRowSyncStatus = (row, matchingEntry = null) => {
  if (row?.is_local_only) {
    return row.sync_status || "";
  }

  if (matchingEntry) {
    return buildSyncDescriptor(matchingEntry).status;
  }

  return row?.sync_status || "";
};

export const isSelectableClaimStubRow = (row) => {
  const presentationStatus = String(row?.presentation_status || "")
    .trim()
    .toUpperCase();
  const syncStatus = String(row?.sync_status || "")
    .trim()
    .toUpperCase();

  return (
    row?.status === "ISSUED" &&
    (!presentationStatus || presentationStatus === "FOR_CLAIM") &&
    !row?.is_local_only &&
    !row?.is_claim_pending &&
    !CLAIM_BLOCKING_SYNC_STATUSES.has(syncStatus) &&
    row?.is_active !== false &&
    row?.household?.is_active !== false &&
    isCurrentlyPresentStubRow(row)
  );
};

export const getStubClaimUnavailableMessage = (row) => {
  const householdName = String(
    row?.family_head_name || row?.household?.family_head_name || "",
  ).trim();
  const prefix = householdName && householdName !== "-" ? `${householdName}: ` : "";

  let message;
  if (row?.is_active === false || row?.household?.is_active === false) {
    message =
      "This household is archived and cannot receive a new relief distribution.";
  } else {
    const presenceState = getStubPresenceState(row);
    if (presenceState === "ABSENT") {
      message =
        "This household is not currently present in the evacuation center for this disaster event.";
    } else if (presenceState === "UNKNOWN") {
      message =
        "Current evacuation presence could not be confirmed. Refresh the distribution list and try again.";
    } else {
      message =
        "This relief stub is not currently available to claim. Check the stub status and refresh the list before trying again.";
    }
  }

  return `${prefix}${message}`;
};
