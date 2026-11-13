const FIXED_MODEL = "FIXED_MODEL";
const AUTO_BACKTEST = "AUTO_BACKTEST";

const getForecastSelectionMode = (forecastRun) =>
  forecastRun?.selection_mode ?? FIXED_MODEL;

const getEffectiveSelectedModel = (forecastRun, forecastResult) => {
  if (getForecastSelectionMode(forecastRun) === AUTO_BACKTEST) {
    return forecastResult?.selected_model_name ?? null;
  }

  return (
    forecastResult?.selected_model_name ??
    forecastRun?.model_name ??
    null
  );
};

module.exports = {
  FIXED_MODEL,
  AUTO_BACKTEST,
  getForecastSelectionMode,
  getEffectiveSelectedModel,
};
