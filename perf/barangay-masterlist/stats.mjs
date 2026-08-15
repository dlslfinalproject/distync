const numericValues = (values) =>
  values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);

const percentile = (values, percentileValue) => {
  const safeValues = numericValues(values);

  if (safeValues.length === 0) {
    return null;
  }

  const index = Math.ceil((percentileValue / 100) * safeValues.length) - 1;
  return safeValues[Math.min(Math.max(index, 0), safeValues.length - 1)];
};

export const summarizeNumbers = (values) => {
  const safeValues = numericValues(values);

  if (safeValues.length === 0) {
    return {
      min: null,
      median: null,
      p90: null,
      p95: null,
      max: null,
    };
  }

  return {
    min: safeValues[0],
    median: percentile(safeValues, 50),
    p90: percentile(safeValues, 90),
    p95: percentile(safeValues, 95),
    max: safeValues[safeValues.length - 1],
  };
};

const validSamples = (samples, type) =>
  samples.filter(
    (sample) =>
      sample.type === type &&
      ["PASS", "PASS WITH PERFORMANCE WARNING"].includes(sample.result),
  );

const buildGroupStatistics = (samples) => ({
  dashboardDurationMs: summarizeNumbers(
    samples.map((sample) => sample.dashboardDurationMs),
  ),
  dashboardTtfbMs: summarizeNumbers(samples.map((sample) => sample.dashboardTtfbMs)),
  masterlistDurationMs: summarizeNumbers(
    samples.map((sample) => sample.masterlistDurationMs),
  ),
  masterlistTtfbMs: summarizeNumbers(samples.map((sample) => sample.masterlistTtfbMs)),
  timeToMasterlistResponseMs: summarizeNumbers(
    samples.map((sample) => sample.timeToMasterlistResponseMs),
  ),
  timeToEventResolvedMs: summarizeNumbers(
    samples.map((sample) => sample.timeToEventResolvedMs),
  ),
  timeToDataVisibleMs: summarizeNumbers(
    samples.map((sample) => sample.timeToDataVisibleMs),
  ),
  timeToUsableMs: summarizeNumbers(samples.map((sample) => sample.timeToUsableMs)),
});

export const buildStatistics = (samples) => ({
  warmRefresh: buildGroupStatistics(validSamples(samples, "warm-refresh")),
  cacheBypassRefresh: buildGroupStatistics(
    validSamples(samples, "cache-bypass-refresh"),
  ),
  eventSwitch: buildGroupStatistics(validSamples(samples, "event-switch")),
  rapidSwitch: buildGroupStatistics(validSamples(samples, "rapid-event-switch")),
});
