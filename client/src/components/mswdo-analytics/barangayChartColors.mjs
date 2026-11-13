export const BARANGAY_CHART_HIGHLIGHT_COLOR = "#2f6499";

export const BARANGAY_CHART_COLORS = Object.freeze([
  "#1f9d8a",
  "#f59e0b",
  "#7c8fd6",
  "#d977a8",
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#0ea5e9",
  "#f97316",
  "#64748b",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#6366f1",
  "#10b981",
  "#f43f5e",
]);

const getFallbackBarangayChartColor = (index) => {
  const hue = (index * 47 + 18) % 360;
  return `hsl(${hue}, 62%, 46%)`;
};

const getEntryName = (item) => {
  const name = item?.name ?? item?.barangay_name ?? "";
  return String(name).trim();
};

export const getBarangayChartColors = (data = [], dataKey = "value") => {
  const items = Array.isArray(data) ? data : [];

  if (items.length === 0) {
    return [];
  }

  const highestValue = Math.max(
    ...items.map((item) => Number(item?.[dataKey] || 0)),
  );
  const firstHighestIndex = items.findIndex(
    (item) => Number(item?.[dataKey] || 0) === highestValue,
  );

  return items.map((item, index) => {
    if (
      Number(item?.[dataKey] || 0) === highestValue &&
      index === firstHighestIndex
    ) {
      return BARANGAY_CHART_HIGHLIGHT_COLOR;
    }

    const paletteIndex = index > firstHighestIndex ? index - 1 : index;
    return (
      BARANGAY_CHART_COLORS[paletteIndex] ||
      getFallbackBarangayChartColor(paletteIndex)
    );
  });
};

export const getBarangayChartColorMap = ({
  sourceData = [],
  sourceDataKey = "value",
  targetData = [],
} = {}) => {
  const sourceItems = Array.isArray(sourceData) ? sourceData : [];
  const targetItems = Array.isArray(targetData) ? targetData : [];
  const sourceColors = getBarangayChartColors(sourceItems, sourceDataKey);
  const colorMap = {};
  const usedColors = new Set();

  sourceItems.forEach((item, index) => {
    const name = getEntryName(item);

    if (!name || colorMap[name]) {
      return;
    }

    colorMap[name] = sourceColors[index];
    usedColors.add(sourceColors[index]);
  });

  let nextPaletteIndex = 0;

  targetItems.forEach((item) => {
    const name = getEntryName(item);

    if (!name || colorMap[name]) {
      return;
    }

    while (
      nextPaletteIndex < BARANGAY_CHART_COLORS.length &&
      usedColors.has(BARANGAY_CHART_COLORS[nextPaletteIndex])
    ) {
      nextPaletteIndex += 1;
    }

    const color =
      BARANGAY_CHART_COLORS[nextPaletteIndex] ||
      getFallbackBarangayChartColor(nextPaletteIndex);

    colorMap[name] = color;
    usedColors.add(color);
    nextPaletteIndex += 1;
  });

  return colorMap;
};
