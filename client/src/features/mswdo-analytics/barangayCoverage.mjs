const normalizeBarangay = (barangay) => {
  if (typeof barangay === "string") {
    return { id: barangay, name: barangay };
  }

  return {
    id: barangay?.id || barangay?.barangay_id || "",
    name: String(barangay?.name || barangay?.barangay_name || "").trim(),
  };
};

export const mapBarangayCoverageDistribution = ({
  barangays = [],
  coveredCount,
} = {}) => {
  const safeCoveredCount = Number(coveredCount || 0);
  const namedBarangays = (Array.isArray(barangays) ? barangays : [])
    .map(normalizeBarangay)
    .filter((barangay) => barangay.name)
    .sort((left, right) => left.name.localeCompare(right.name));
  const canNameEachCoveredBarangay =
    safeCoveredCount > 0 && namedBarangays.length === safeCoveredCount;

  if (canNameEachCoveredBarangay) {
    return namedBarangays.map((barangay) => ({
      barangay_id: barangay.id,
      name: barangay.name,
      value: 1,
    }));
  }

  const barangayCount = namedBarangays.length;

  if (barangayCount === 0 && safeCoveredCount === 0) {
    return [];
  }

  const totalBarangays = Math.max(barangayCount, safeCoveredCount);
  const notCoveredCount = Math.max(totalBarangays - safeCoveredCount, 0);

  return [
    {
      name: "Covered",
      value: safeCoveredCount,
    },
    {
      name: "Not Covered",
      value: notCoveredCount,
    },
  ].filter((item) => item.value > 0);
};
