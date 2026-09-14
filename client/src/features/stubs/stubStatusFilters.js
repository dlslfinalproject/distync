export const STATUS_FILTERS = {
  ALL: "all",
  CLAIMED: "claimed",
  UNCLAIMED: "unclaimed",
  NOT_PRESENT: "not_present",
};

const NORMALIZED_STATUS_TO_ROW_STATUS = {
  [STATUS_FILTERS.CLAIMED]: "CLAIMED",
  [STATUS_FILTERS.UNCLAIMED]: "ISSUED",
  [STATUS_FILTERS.NOT_PRESENT]: "NOT_PRESENT",
};

export const normalizeStubStatusFilter = (statusFilter) => {
  const normalizedValue = String(statusFilter || "").trim().toLowerCase();

  if (!normalizedValue) {
    return STATUS_FILTERS.ALL;
  }

  if (
    normalizedValue === STATUS_FILTERS.ALL ||
    normalizedValue === STATUS_FILTERS.CLAIMED ||
    normalizedValue === STATUS_FILTERS.UNCLAIMED ||
    normalizedValue === STATUS_FILTERS.NOT_PRESENT
  ) {
    return normalizedValue;
  }

  if (normalizedValue === "issued") {
    return STATUS_FILTERS.UNCLAIMED;
  }

  if (normalizedValue === "claimed") {
    return STATUS_FILTERS.CLAIMED;
  }

  if (normalizedValue === "not present" || normalizedValue === "not-present") {
    return STATUS_FILTERS.NOT_PRESENT;
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
  const normalizedStatusFilter = normalizeStubStatusFilter(statusFilter);
  const normalizedRowStatus = String(rowStatus || "").toUpperCase();

  if (normalizedStatusFilter === STATUS_FILTERS.UNCLAIMED) {
    return ["ISSUED", "FOR_CLAIM"].includes(normalizedRowStatus);
  }

  if (normalizedStatusFilter === STATUS_FILTERS.NOT_PRESENT) {
    return normalizedRowStatus === "NOT_PRESENT";
  }

  const expectedRowStatus = getStubRowStatusFilter(statusFilter);

  if (!expectedRowStatus) {
    return true;
  }

  return normalizedRowStatus === expectedRowStatus;
};
