const ACCESS_MODES = {
  DEVELOPMENT: "DEVELOPMENT",
  DEMO: "DEMO",
};

const normalizeAccessMode = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();
  return Object.values(ACCESS_MODES).includes(normalizedValue)
    ? normalizedValue
    : null;
};

const getServerAccessMode = () => {
  return (
    normalizeAccessMode(process.env.SERVER_ACCESS_MODE) ||
    normalizeAccessMode(process.env.ACCESS_MODE) ||
    ACCESS_MODES.DEMO
  );
};

const isDevelopmentBypassEnabled = () => {
  const explicitBypassFlag =
    String(process.env.ENABLE_DEVELOPMENT_AUTH_BYPASS || "").toLowerCase() ===
    "true";

  return (
    getServerAccessMode() === ACCESS_MODES.DEVELOPMENT && explicitBypassFlag
  );
};

module.exports = {
  ACCESS_MODES,
  getServerAccessMode,
  isDevelopmentBypassEnabled,
};
