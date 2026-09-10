import { sortMasterlistRows } from "../masterlist/masterlistSort.js";
import { resolveEffectiveMasterlistRows } from "../masterlist/barangayMasterlistUi.js";

const normalizeId = (value) => String(value ?? "").trim();

const isActiveRow = (row) => row?.is_operationally_active !== false;

const matchesRecordStatus = (row, recordStatus) =>
  recordStatus === "all" ||
  (recordStatus === "archived" ? !isActiveRow(row) : isActiveRow(row));

const matchesSearch = (row, searchTerm) => {
  const normalizedSearch = String(searchTerm || "").trim().toLowerCase();

  if (!normalizedSearch) return true;

  return [
    row.family_head_name,
    row.address,
    row.sectors_text,
    row.arrival_time_text,
    row.departure_time_text,
    row.barangay_name,
  ].some((value) =>
    String(value || "").toLowerCase().includes(normalizedSearch),
  );
};

const filterProjectedRows = ({ rows, selectedBarangayId, recordStatus, searchTerm, selectedSectorIds }) => {
  const barangayId = normalizeId(selectedBarangayId);
  const sectorCodes = new Set((Array.isArray(selectedSectorIds) ? selectedSectorIds : []).map(normalizeId));
  return rows.filter((row) => {
    if (barangayId && normalizeId(row?.barangay_id) !== barangayId) return false;
    if (!matchesRecordStatus(row, recordStatus)) return false;
    if (sectorCodes.size > 0 && !(row?.sector_codes || []).some((code) => sectorCodes.has(normalizeId(code)))) return false;
    return matchesSearch(row, searchTerm);
  });
};

export const buildMswdoOfflineMasterlistPayload = ({
  households = [],
  mapRow,
  selectedBarangayId = "",
  recordStatus = "active",
  searchTerm = "",
  selectedSectorIds = [],
  selectedSortOrder = "newest",
  currentPage = 1,
  pageSize = 25,
  basePayload = {},
  syncQueueEntries = [],
  selectedEventTitle = "",
  sectorOptions = [],
} = {}) => {
  const sourceRows = Array.isArray(households) ? households : [];
  const mapHousehold = typeof mapRow === "function" ? mapRow : (household) => household;
  const mappedRows = sourceRows.map((household) => ({
    household,
    row: mapHousehold(household, sourceRows),
  }));
  const projectedRows = resolveEffectiveMasterlistRows({
    rows: mappedRows.map(({ row }) => row).filter(Boolean),
    syncQueueEntries,
    recordStatus: "all",
    selectedEventId: basePayload?.filters?.disaster_event_id || "",
    selectedEventTitle,
    sectorOptions,
    sortOrder: selectedSortOrder,
  });
  const filteredRows = filterProjectedRows({
    rows: projectedRows,
    selectedBarangayId,
    recordStatus,
    searchTerm,
    selectedSectorIds,
  });
  const sortedRows = sortMasterlistRows(
    filteredRows,
    selectedSortOrder,
    { recordStatus },
  );
  const safePageSize = Math.max(Number(pageSize) || 25, 1);
  const safePage = Math.max(Number(currentPage) || 1, 1);
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / safePageSize);
  const pageRows = sortedRows.slice(
    (safePage - 1) * safePageSize,
    safePage * safePageSize,
  );
  const sourceByHouseholdId = new Map(
    mappedRows.map(({ household }) => [
      String(household?.household_id || household?.id || ""),
      household,
    ]),
  );

  return {
    ...basePayload,
    count: totalItems,
    data: pageRows.map((row) => sourceByHouseholdId.get(String(row?.household_id || "")) || row),
    offline_projected_rows: pageRows,
    offline_all_projected_rows: projectedRows,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
};
