import { resolveEffectiveMasterlistRows } from "../masterlist/barangayMasterlistUi.js";

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const details = (row) => row?.offline_household_details || {};
const household = (row) => details(row).household || {};

const familyKey = (row) => {
  const profile = row?.local_duplicate_profile || {};
  const head = profile.family_head || {};
  return [
    household(row).family_head_first_name || head.first_name,
    household(row).family_head_middle_name || head.middle_name,
    household(row).family_head_last_name || head.last_name || row?.family_head_name,
    household(row).family_head_suffix || head.suffix,
    household(row).sex || head.sex,
    household(row).contact_number || profile.contact_number || row?.contact_number,
  ].map((value, index) => index === 5 ? normalize(value).replace(/\s/g, "") : normalize(value)).join("|");
};

const timestamp = (row) => {
  const value = household(row).updated_at || row?.updated_at || household(row).registered_at || row?.registered_at;
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const memberCount = (row) => Number(
  household(row).household_size || row?.members_count || details(row).members?.length || 0,
);

export const deriveBarangayDashboardMetrics = ({
  rows = [], syncQueueEntries = [], selectedEventId = "", assignedBarangayId = "", assignedBarangayName = "",
} = {}) => {
  const effectiveRows = resolveEffectiveMasterlistRows({
    rows, syncQueueEntries, recordStatus: "all", selectedEventId, assignedBarangayId, assignedBarangayName,
  });
  const latestByFamily = new Map();
  effectiveRows.forEach((row) => {
    const key = familyKey(row);
    if (!latestByFamily.has(key) || timestamp(row) >= timestamp(latestByFamily.get(key))) latestByFamily.set(key, row);
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
