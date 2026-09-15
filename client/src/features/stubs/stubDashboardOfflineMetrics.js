const emptyStubDashboardMetrics = Object.freeze({
  total_issued_stubs: 0,
  claimed_stubs: 0,
  unclaimed_stubs: 0,
  beneficiary_families: 0,
});

const getRowStatus = (row) =>
  String(row?.presentation_status || row?.status || "")
    .trim()
    .toUpperCase();

const getHouseholdId = (row) =>
  row?.household_id || row?.household?.id || row?.household_occurrence_id || "";

export const deriveStubDashboardMetrics = (rows = []) => {
  const issuedRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => !row?.is_local_only,
  );
  const beneficiaryFamilyIds = new Set(
    issuedRows.map(getHouseholdId).filter(Boolean).map(String),
  );

  return {
    ...emptyStubDashboardMetrics,
    total_issued_stubs: issuedRows.length,
    claimed_stubs: issuedRows.filter((row) => getRowStatus(row) === "CLAIMED")
      .length,
    unclaimed_stubs: issuedRows.filter(
      (row) => getRowStatus(row) === "FOR_CLAIM",
    ).length,
    beneficiary_families: beneficiaryFamilyIds.size,
  };
};
