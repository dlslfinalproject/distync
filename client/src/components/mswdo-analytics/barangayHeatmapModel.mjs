export const BARANGAY_HEATMAP_METRICS = Object.freeze([
  { key: "registered_households", label: "Registered Households" },
  { key: "active_evacuees", label: "Active Evacuees" },
  { key: "pending_relief_claims", label: "Pending Relief Claims" },
]);

export const DEFAULT_BARANGAY_HEATMAP_METRIC = "registered_households";

export const BARANGAY_HEATMAP_COLORS = Object.freeze([
  "#e9f3fa",
  "#d3e4f0",
  "#b0ccdf",
  "#7ea6c4",
  "#4a789d",
]);

export const BARANGAY_HEATMAP_UNAFFECTED_COLOR = "#dce3e9";

const getMetric = (metricKey) =>
  BARANGAY_HEATMAP_METRICS.find((metric) => metric.key === metricKey) ||
  BARANGAY_HEATMAP_METRICS[0];

const getNumericValue = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0
      ? numericValue
      : null;
  }

  return null;
};

const getFeatureName = (feature, code, row) =>
  row?.barangay_name ||
  feature?.properties?.adm4_name ||
  feature?.properties?.adm4_ref_n ||
  code ||
  "Unknown barangay";

export const indexBarangayHeatmapRows = (barangayRows) => {
  const sourceRows = Array.isArray(barangayRows) ? barangayRows : [];
  const rowsByCode = new Map();

  for (const row of sourceRows) {
    const code = typeof row?.barangay_code === "string" ? row.barangay_code : "";
    if (!code) continue;
    const matches = rowsByCode.get(code) || [];
    matches.push(row);
    rowsByCode.set(code, matches);
  }

  return {
    rowsByCode,
    rowCount: sourceRows.length,
    hasData: Array.isArray(barangayRows) && sourceRows.length > 0,
  };
};

export const buildBarangayHeatmapModel = (
  features,
  barangayRowLookup,
  metricKey = DEFAULT_BARANGAY_HEATMAP_METRIC,
) => {
  const metric = getMetric(metricKey);
  const featureList = Array.isArray(features) ? features : [];
  const rowLookup =
    barangayRowLookup?.rowsByCode instanceof Map
      ? barangayRowLookup
      : indexBarangayHeatmapRows(barangayRowLookup);
  const featureCountsByCode = new Map();

  for (const feature of featureList) {
    const code = feature?.properties?.distync_code;
    if (!code) continue;
    featureCountsByCode.set(code, (featureCountsByCode.get(code) || 0) + 1);
  }

  const joinedRows = featureList.map((feature, index) => {
    const code = feature?.properties?.distync_code || "";
    const candidates = code ? rowLookup.rowsByCode.get(code) || [] : [];
    const hasOneToOneMatch =
      candidates.length === 1 && featureCountsByCode.get(code) === 1;
    const candidate = hasOneToOneMatch ? candidates[0] : null;
    const value = candidate ? getNumericValue(candidate[metric.key]) : null;
    const hasValidStatus = typeof candidate?.is_affected === "boolean";
    const isAvailable = Boolean(candidate && hasValidStatus && value !== null);
    const status = isAvailable
      ? candidate.is_affected
        ? "affected"
        : "unaffected"
      : "unavailable";

    return {
      key: code || feature?.id || "feature-" + (index + 1),
      code,
      name: getFeatureName(feature, code, candidate),
      feature,
      apiRow: isAvailable ? candidate : null,
      status,
      value: isAvailable ? value : null,
      colorIndex: null,
      fill:
        status === "unaffected"
          ? BARANGAY_HEATMAP_UNAFFECTED_COLOR
          : null,
    };
  });

  const affectedValues = joinedRows
    .filter((row) => row.status === "affected")
    .map((row) => row.value);
  const maxValue = affectedValues.reduce(
    (maximum, value) => Math.max(maximum, value),
    0,
  );
  const scaleCeiling = Math.max(5, maxValue);

  const rows = joinedRows.map((row) => {
    if (row.status !== "affected") return row;

    const colorIndex =
      row.value === 0 || maxValue === 0
        ? 0
        : Math.max(
            1,
            Math.min(
              BARANGAY_HEATMAP_COLORS.length - 1,
              Math.round(
                (row.value / scaleCeiling) *
                  (BARANGAY_HEATMAP_COLORS.length - 1),
              ),
            ),
          );

    return {
      ...row,
      colorIndex,
      fill: BARANGAY_HEATMAP_COLORS[colorIndex],
    };
  });

  const affectedCount = rows.filter((row) => row.status === "affected").length;
  const unavailableCount = rows.filter(
    (row) => row.status === "unavailable",
  ).length;
  const hasData = rowLookup.hasData;

  return {
    metric,
    rows,
    hasData,
    affectedCount,
    unavailableCount,
    maxValue,
    scaleCeiling,
    matchedCount: rows.length - unavailableCount,
    hasJoinMismatch:
      hasData &&
      (unavailableCount > 0 || rowLookup.rowCount !== featureList.length),
  };
};

export const getSelectedBarangayHeatmapRow = (model, selectedKey) =>
  model?.rows?.find((row) => row.key === selectedKey) || null;

export const createBarangayHeatmapInteractionHandlers = (
  barangayKey,
  onSelect,
) => ({
  onClick: () => onSelect(barangayKey),
  onKeyDown: (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(barangayKey);
  },
});
