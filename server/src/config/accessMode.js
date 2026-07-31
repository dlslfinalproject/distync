const ACCESS_MODES = {
  DEVELOPMENT: "DEVELOPMENT",
  DEMO: "DEMO",
};

const ACCESS_MODE_ENV_NAME = "SERVER_ACCESS_MODE";

class AccessModeConfigurationError extends Error {
  constructor(message = "") {
    super(message);
    this.name = "AccessModeConfigurationError";
  }
}

const getServerAccessModeConfigurationErrorMessage = () => {
  return "DISTYNC server configuration error: SERVER_ACCESS_MODE must be set to DEVELOPMENT or DEMO.";
};

const parseServerAccessMode = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AccessModeConfigurationError(
      getServerAccessModeConfigurationErrorMessage(),
    );
  }

  const normalizedValue = value.trim();

  if (Object.values(ACCESS_MODES).includes(normalizedValue)) {
    return normalizedValue;
  }

  throw new AccessModeConfigurationError(
    getServerAccessModeConfigurationErrorMessage(),
  );
};

const getServerAccessMode = (env = process.env) => {
  return parseServerAccessMode(env?.[ACCESS_MODE_ENV_NAME]);
};

const parseDevelopmentBypassFlag = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return value.trim().toLowerCase() === "true";
};

const isDevelopmentBypassEnabled = (env = process.env) => {
  return (
    getServerAccessMode(env) === ACCESS_MODES.DEVELOPMENT &&
    parseDevelopmentBypassFlag(env?.ENABLE_DEVELOPMENT_AUTH_BYPASS)
  );
};

module.exports = {
  ACCESS_MODES,
  ACCESS_MODE_ENV_NAME,
  AccessModeConfigurationError,
  getServerAccessMode,
  getServerAccessModeConfigurationErrorMessage,
  isDevelopmentBypassEnabled,
  parseDevelopmentBypassFlag,
  parseServerAccessMode,
};
