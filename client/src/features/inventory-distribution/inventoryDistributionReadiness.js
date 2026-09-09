const getDistributionRowIdentity = (row) =>
  String(
    row?.stub_id ||
      row?.masterlist_record_id ||
      row?.household_id ||
      row?.display_stub_no ||
      row?.family_head_name ||
      "unknown",
  );

export const buildInventoryDistributionReadinessScopeKey = ({
  isOpen = false,
  showReadinessStatus = false,
  row = null,
  disasterEventId = "",
  requestSequence = 0,
} = {}) => {
  if (!isOpen || !showReadinessStatus || !row || !disasterEventId) {
    return "";
  }

  return [
    String(requestSequence),
    String(disasterEventId),
    getDistributionRowIdentity(row),
  ].join("|");
};
export const createInventoryDistributionReadinessRequestGuard = () => {
  let generation = 0;

  return {
    start: () => {
      generation += 1;
      return generation;
    },
    invalidate: () => {
      generation += 1;
      return generation;
    },
    isCurrent: (requestGeneration) => requestGeneration === generation,
  };
};
