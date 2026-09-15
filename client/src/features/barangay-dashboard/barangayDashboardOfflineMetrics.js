import { resolveEffectiveMasterlistRows } from "../masterlist/barangayMasterlistUi.js";

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const details = (row) => row?.offline_household_details || {};
const household = (row) => details(row).household || {};

const householdId = (row) =>
  row?.household_id || household(row).id || row?.id || "";

const sourceHouseholdId = (row) =>
  row?.source_household_id ||
  household(row).source_household_id ||
  household(row).re_admission_source_household_id ||
  "";

const familyIdentityKey = (row, rowsByHouseholdId) => {
  let identity = String(householdId(row) || "");
  let currentRow = row;
  const visited = new Set();

  while (identity && !visited.has(identity)) {
    visited.add(identity);
    const sourceId = String(sourceHouseholdId(currentRow) || "");

    if (!sourceId) {
      break;
    }

    identity = sourceId;
    currentRow = rowsByHouseholdId.get(sourceId);

    if (!currentRow) {
      break;
    }
  }

  return identity ? `household:${identity}` : "";
};

const timestamp = (row) => {
  const value = household(row).updated_at || row?.updated_at || household(row).registered_at || row?.registered_at;
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const memberCount = (row) => Number(
  household(row).household_size || row?.members_count || details(row).members?.length || 0,
);

const isCurrentHouseholdOccurrence = (row) =>
  (row?.is_active ?? household(row).is_active) !== false;

const shouldReplaceLatestOccurrence = (candidate, current) => {
  const candidateIsCurrent = isCurrentHouseholdOccurrence(candidate);
  const currentIsCurrent = isCurrentHouseholdOccurrence(current);

  if (candidateIsCurrent !== currentIsCurrent) {
    return candidateIsCurrent;
  }

  return timestamp(candidate) >= timestamp(current);
};

export const deriveBarangayDashboardMetrics = ({
  rows = [], syncQueueEntries = [], selectedEventId = "", assignedBarangayId = "", assignedBarangayName = "",
} = {}) => {
  const effectiveRows = resolveEffectiveMasterlistRows({
    rows, syncQueueEntries, recordStatus: "all", selectedEventId, assignedBarangayId, assignedBarangayName,
  });
  const rowsByHouseholdId = new Map(
    effectiveRows
      .map((row) => [String(householdId(row) || ""), row])
      .filter(([id]) => id),
  );
  const latestByFamily = new Map();
  effectiveRows.forEach((row) => {
    const key = familyIdentityKey(row, rowsByHouseholdId);
    if (!key) {
      return;
    }

    const current = latestByFamily.get(key);
    if (!current || shouldReplaceLatestOccurrence(row, current)) {
      latestByFamily.set(key, row);
    }
  });
  const latestRows = [...latestByFamily.values()];
  const isEvacuationCenter = (row) => normalize(row?.current_stay_type || household(row).current_stay_type) === "evac_center";
  return {
    total_evacuees_individuals: latestRows.reduce((sum, row) => sum + memberCount(row), 0),
    total_families: latestRows.length,
    currently_admitted_evacuees: latestRows.reduce((sum, row) => sum + (isEvacuationCenter(row) && row.is_operationally_active !== false ? memberCount(row) : 0), 0),
    total_departed_evacuees: latestRows.reduce((sum, row) => sum + (isEvacuationCenter(row) && row.is_operationally_active === false ? memberCount(row) : 0), 0),
  };
};
