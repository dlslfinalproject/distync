import { sortMasterlistRows } from "../masterlist/masterlistSort.js";

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
} = {}) => {
  const sourceRows = Array.isArray(households) ? households : [];
  const mapHousehold = typeof mapRow === "function" ? mapRow : (household) => household;
  const mappedRows = sourceRows.map((household) => ({
    household,
    row: mapHousehold(household, sourceRows),
  }));
  const normalizedBarangayId = normalizeId(selectedBarangayId);
  const selectedSectorCodes = new Set(
    (Array.isArray(selectedSectorIds) ? selectedSectorIds : []).map(normalizeId),
  );

  const filteredRows = mappedRows.filter(({ row }) => {
    if (
      normalizedBarangayId &&
      normalizeId(row?.barangay_id) !== normalizedBarangayId
    ) {
      return false;
    }

    if (!matchesRecordStatus(row, recordStatus)) return false;

    if (
      selectedSectorCodes.size > 0 &&
      !(row?.sector_codes || []).some((code) =>
        selectedSectorCodes.has(normalizeId(code)),
      )
    ) {
      return false;
    }

    return matchesSearch(row, searchTerm);
  });
  const sortedRows = sortMasterlistRows(
    filteredRows.map(({ row }) => row),
    selectedSortOrder,
    { recordStatus },
  );
  const sourceByRow = new Map(
    filteredRows.map(({ household, row }) => [row, household]),
  );
  const sortedHouseholds = sortedRows.map((row) => sourceByRow.get(row));
  const safePageSize = Math.max(Number(pageSize) || 25, 1);
  const safePage = Math.max(Number(currentPage) || 1, 1);
  const totalItems = sortedHouseholds.length;
  const totalPages = Math.ceil(totalItems / safePageSize);
  const pageRows = sortedHouseholds.slice(
    (safePage - 1) * safePageSize,
    safePage * safePageSize,
  );

  return {
    ...basePayload,
    count: totalItems,
    data: pageRows,
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
