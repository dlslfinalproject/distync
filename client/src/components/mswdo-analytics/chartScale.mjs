export const CHART_AXIS_INCREMENT = 5;

const MINIMUM_AXIS_MAX = CHART_AXIS_INCREMENT;

export const getChartAxisMax = (highestValue) => {
  const numericValue = Number(highestValue);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return MINIMUM_AXIS_MAX;
  }

  return Math.max(
    MINIMUM_AXIS_MAX,
    Math.ceil(numericValue / CHART_AXIS_INCREMENT) * CHART_AXIS_INCREMENT,
  );
};

export const getChartAxisTicks = ({
  axisMax,
  isCompact = false,
  isNarrow = false,
}) => {
  const normalizedAxisMax = getChartAxisMax(axisMax);
  const tickIncrement =
    isNarrow || (isCompact && normalizedAxisMax > 50)
      ? CHART_AXIS_INCREMENT * 2
      : CHART_AXIS_INCREMENT;
  const ticks = [];

  for (let value = 0; value <= normalizedAxisMax; value += tickIncrement) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== normalizedAxisMax) {
    ticks.push(normalizedAxisMax);
  }

  return ticks;
};
