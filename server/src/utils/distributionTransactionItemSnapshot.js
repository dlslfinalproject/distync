const getDistributionItemSourceReliefTypeSnapshot = ({
  sourceType,
  source_type: sourceTypeSnakeCase,
  sourceReliefType,
  source_relief_type: sourceReliefTypeSnakeCase,
  donatedReliefPackName,
  donated_relief_pack_name: donatedReliefPackNameSnakeCase,
} = {}) => {
  const normalizedSourceType = String(sourceType || sourceTypeSnakeCase || "")
    .trim()
    .toUpperCase();
  const normalizedSourceReliefType = String(
    sourceReliefType || sourceReliefTypeSnakeCase || "",
  )
    .trim()
    .toUpperCase();
  const normalizedDonatedReliefPackName = String(
    donatedReliefPackName || donatedReliefPackNameSnakeCase || "",
  ).trim();

  if (normalizedSourceType === "DONATED") {
    return normalizedSourceReliefType === "DONATED_RELIEF_PACK" ||
      normalizedDonatedReliefPackName
      ? "DONATED_RELIEF_PACK"
      : "DONATED_LOOSE_ITEM";
  }

  return normalizedSourceType || normalizedSourceReliefType || "LGU";
};

module.exports = {
  getDistributionItemSourceReliefTypeSnapshot,
};
