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
  padding: 24,
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

const getProjectedRing = (ring, projection) =>
  Array.isArray(ring)
    ? ring
        .map((position) => projection(position))
        .filter(
          (point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            point.every(Number.isFinite),
        )
    : [];

const getProjectedPolygonParts = (geometry, projection) => {
  if (!geometry || !projection) return [];
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  return polygons
    .map((polygon) =>
      Array.isArray(polygon)
        ? polygon.map((ring) => getProjectedRing(ring, projection))
        : [],
    )
    .filter((rings) => rings[0]?.length >= 3);
};

const getRingArea = (ring) =>
  ring.reduce((area, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;

const getLargestProjectedPolygon = (parts) =>
  parts.reduce(
    (largest, rings) =>
      !largest || Math.abs(getRingArea(rings[0])) > Math.abs(getRingArea(largest[0]))
        ? rings
        : largest,
    null,
  );

const getRingBounds = (ring) =>
  ring.reduce(
    (bounds, [x, y]) => ({
      left: Math.min(bounds.left, x),
      right: Math.max(bounds.right, x),
      top: Math.min(bounds.top, y),
      bottom: Math.max(bounds.bottom, y),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );

const isPointInsideRing = ([x, y], ring) => {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) /
          (previousY - currentY || Number.EPSILON) +
          currentX;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const isPointInsideProjectedPolygon = (point, rings) =>
  Array.isArray(rings) &&
  rings.length > 0 &&
  isPointInsideRing(point, rings[0]) &&
  rings.slice(1).every((hole) => !isPointInsideRing(point, hole));

const distanceToSegmentSquared = (point, start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  const projection = [start[0] + t * dx, start[1] + t * dy];
  return (point[0] - projection[0]) ** 2 + (point[1] - projection[1]) ** 2;
};

const getPointClearanceSquared = (point, rings) => {
  let minimum = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 1) {
      minimum = Math.min(
        minimum,
        distanceToSegmentSquared(
          point,
          ring[index],
          ring[(index + 1) % ring.length],
        ),
      );
    }
  }
  return minimum;
};

const findInteriorPoint = (rings, preferredPoint) => {
  const bounds = getRingBounds(rings[0]);
  let best =
    preferredPoint && isPointInsideProjectedPolygon(preferredPoint, rings)
      ? preferredPoint
      : null;
  let searchBounds = bounds;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const columns = 16;
    const rows = 16;
    const stepX = (searchBounds.right - searchBounds.left) / columns;
    const stepY = (searchBounds.bottom - searchBounds.top) / rows;

    for (let column = 0; column <= columns; column += 1) {
      for (let row = 0; row <= rows; row += 1) {
        const candidate = [
          searchBounds.left + column * stepX,
          searchBounds.top + row * stepY,
        ];
        if (!isPointInsideProjectedPolygon(candidate, rings)) continue;
        if (
          !best ||
          getPointClearanceSquared(candidate, rings) >
            getPointClearanceSquared(best, rings)
        ) {
          best = candidate;
        }
      }
    }

    if (!best) break;
    const radiusX = stepX * 2;
    const radiusY = stepY * 2;
    searchBounds = {
      left: Math.max(bounds.left, best[0] - radiusX),
      right: Math.min(bounds.right, best[0] + radiusX),
      top: Math.max(bounds.top, best[1] - radiusY),
      bottom: Math.min(bounds.bottom, best[1] + radiusY),
    };
  }

  return (
    best ||
    preferredPoint ||
    [(bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2]
  );
};

export const getBarangayHeatmapInteriorPoint = (
  feature,
  projection,
  preferredPoint,
) => {
  const parts = getProjectedPolygonParts(feature?.geometry, projection);
  const rings = getLargestProjectedPolygon(parts);
  return rings
    ? findInteriorPoint(rings, preferredPoint)
    : preferredPoint || null;
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
    features.map((feature) => [
      feature,
      getBarangayHeatmapInteriorPoint(
        feature,
        projection,
        pathGenerator.centroid(feature),
      ),
    ]),
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
