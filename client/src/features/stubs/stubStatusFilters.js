export const STATUS_FILTERS = {
  ALL: "all",
  CLAIMED: "claimed",
  UNCLAIMED: "unclaimed",
};

const NORMALIZED_STATUS_TO_ROW_STATUS = {
  [STATUS_FILTERS.CLAIMED]: "CLAIMED",
  [STATUS_FILTERS.UNCLAIMED]: "ISSUED",
};

export const normalizeStubStatusFilter = (statusFilter) => {
  const normalizedValue = String(statusFilter || "").trim().toLowerCase();

  if (!normalizedValue) {
    return STATUS_FILTERS.ALL;
  }

  if (
    normalizedValue === STATUS_FILTERS.ALL ||
    normalizedValue === STATUS_FILTERS.CLAIMED ||
    normalizedValue === STATUS_FILTERS.UNCLAIMED
  ) {
    return normalizedValue;
  }

  if (normalizedValue === "issued") {
    return STATUS_FILTERS.UNCLAIMED;
  }

  if (normalizedValue === "claimed") {
    return STATUS_FILTERS.CLAIMED;
  }

  return STATUS_FILTERS.ALL;
};

export const getStubRowStatusFilter = (statusFilter) => {
  const normalizedStatusFilter = normalizeStubStatusFilter(statusFilter);

  if (normalizedStatusFilter === STATUS_FILTERS.ALL) {
    return null;
  }

  return NORMALIZED_STATUS_TO_ROW_STATUS[normalizedStatusFilter] || null;
};

export const matchesStubStatusFilter = (rowStatus, statusFilter) => {
  const expectedRowStatus = getStubRowStatusFilter(statusFilter);

  if (!expectedRowStatus) {
    return true;
  }

  return String(rowStatus || "").toUpperCase() === expectedRowStatus;
};
