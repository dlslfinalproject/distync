import { geoMercator, geoPath } from "d3-geo";

export const BARANGAY_HEATMAP_METRICS = Object.freeze([
  { key: "registered_households", label: "Registered Households" },
  { key: "active_evacuees", label: "Active Evacuees" },
  { key: "claimed_stubs", label: "Claimed Relief Stubs" },
  { key: "pending_relief_claims", label: "Pending Relief Claims" },
  { key: "issued_stubs", label: "Valid Issued Stubs" },
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

export const BARANGAY_HEATMAP_VIEWBOX = Object.freeze({
  width: 760,
  height: 540,
  padding: 12,
});

const getPlanarRingSignedArea = (ring) => {
  if (!Array.isArray(ring) || ring.length < 4) return 0;

  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (
      !Array.isArray(current) ||
      !Array.isArray(next) ||
      !Number.isFinite(current[0]) ||
      !Number.isFinite(current[1]) ||
      !Number.isFinite(next[0]) ||
      !Number.isFinite(next[1])
    ) {
      return Number.NaN;
    }

    twiceArea += current[0] * next[1] - next[0] * current[1];
  }

  return twiceArea / 2;
};

const normalizeRingWindingForD3 = (ring, isExteriorRing) => {
  if (!Array.isArray(ring)) return ring;

  const signedArea = getPlanarRingSignedArea(ring);
  const copiedRing = ring.map((position) =>
    Array.isArray(position) ? [...position] : position,
  );

  // D3's spherical polygon convention uses clockwise exteriors and
  // counter-clockwise holes. Keep degenerate or malformed rings unchanged.
  if (!Number.isFinite(signedArea) || signedArea === 0) return copiedRing;

  const isClockwise = signedArea < 0;
  return isClockwise === isExteriorRing ? copiedRing : copiedRing.reverse();
};

const normalizePolygonRingsForD3 = (rings) =>
  Array.isArray(rings)
    ? rings.map((ring, index) => normalizeRingWindingForD3(ring, index === 0))
    : rings;

const normalizeGeometryWindingForD3 = (geometry) => {
  if (!geometry || typeof geometry !== "object") return geometry;

  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: normalizePolygonRingsForD3(geometry.coordinates),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: Array.isArray(geometry.coordinates)
        ? geometry.coordinates.map(normalizePolygonRingsForD3)
        : geometry.coordinates,
    };
  }

  return geometry;
};

export const normalizeGeoJsonWindingForD3 = (geoJson) => {
  if (!geoJson || typeof geoJson !== "object") return geoJson;

  if (geoJson.type === "FeatureCollection") {
    return {
      ...geoJson,
      features: Array.isArray(geoJson.features)
        ? geoJson.features.map(normalizeGeoJsonWindingForD3)
        : geoJson.features,
    };
  }

  if (geoJson.type === "Feature") {
    return {
      ...geoJson,
      geometry: normalizeGeometryWindingForD3(geoJson.geometry),
    };
  }

  return normalizeGeometryWindingForD3(geoJson);
};

export const createBarangayHeatmapGeometry = (sourceGeoJson) => {
  const geoJson = normalizeGeoJsonWindingForD3(sourceGeoJson);
  const { width, height, padding } = BARANGAY_HEATMAP_VIEWBOX;
  const projection = geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    geoJson,
  );
  const pathGenerator = geoPath(projection);
  const features = Array.isArray(geoJson?.features) ? geoJson.features : [];
  const pathByFeature = new Map(
    features.map((feature) => [feature, pathGenerator(feature)]),
  );
  const labelPointByFeature = new Map(
    features.map((feature) => [feature, pathGenerator.centroid(feature)]),
  );

  return {
    geoJson,
    projection,
    pathGenerator,
    pathByFeature,
    labelPointByFeature,
  };
};

const getMetric = (metricKey) =>
  BARANGAY_HEATMAP_METRICS.find((metric) => metric.key === metricKey) ||
  BARANGAY_HEATMAP_METRICS[0];

export const formatBarangayHeatmapTooltip = ({
  barangayName,
  metricLabel,
  value,
}) => `${barangayName}\n${metricLabel} : ${value}`;

export const formatBarangayHeatmapAriaLabel = ({
  barangayName,
  metricLabel,
  value,
}) => `${barangayName}, ${metricLabel}: ${value}`;

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

export const getBarangayHeatmapScaleRanges = (maxValue) => {
  const normalizedMax =
    Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const colorCount = BARANGAY_HEATMAP_COLORS.length;

  return BARANGAY_HEATMAP_COLORS.map((_, index) => {
    if (normalizedMax === 0) {
      return index === 0 ? "0" : "No values";
    }

    const lowerBound =
      index === 0 ? 0 : Math.ceil((index * normalizedMax) / colorCount);
    const upperBound =
      index === colorCount - 1
        ? normalizedMax
        : Math.ceil(((index + 1) * normalizedMax) / colorCount) - 1;

    if (lowerBound > normalizedMax || upperBound < lowerBound) {
      return "No values";
    }

    return lowerBound === upperBound
      ? String(lowerBound)
      : lowerBound + "–" + upperBound;
  });
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
  const scaleCeiling = maxValue;
  const scaleRanges = getBarangayHeatmapScaleRanges(scaleCeiling);

  const rows = joinedRows.map((row) => {
    if (row.status !== "affected") return row;

    const colorIndex =
      scaleCeiling === 0
        ? 0
        : Math.min(
            BARANGAY_HEATMAP_COLORS.length - 1,
            Math.floor(
              (row.value / scaleCeiling) * BARANGAY_HEATMAP_COLORS.length,
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
    scaleRanges,
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
