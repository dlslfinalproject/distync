export const ACCESS_MODES = {
  DEVELOPMENT: "DEVELOPMENT",
  DEMO: "DEMO",
};

const ACCESS_MODE_ENV_NAME = "VITE_ACCESS_MODE";
const validAccessModes = Object.values(ACCESS_MODES);

export class AccessModeConfigurationError extends Error {
  constructor(message = "") {
    super(message);
    this.name = "AccessModeConfigurationError";
  }
}

export const getAccessModeConfigurationErrorMessage = () => {
  return `DISTYNC frontend configuration error: ${ACCESS_MODE_ENV_NAME} must be set exactly to DEVELOPMENT or DEMO.`;
};

export const parseAccessMode = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AccessModeConfigurationError(
      getAccessModeConfigurationErrorMessage(),
    );
  }

  const normalizedValue = value.trim();

  if (validAccessModes.includes(normalizedValue)) {
    return normalizedValue;
  }

  throw new AccessModeConfigurationError(
    getAccessModeConfigurationErrorMessage(),
  );
};

export const validateAccessMode = (env) => {
  const envSource = env || import.meta.env;
  return parseAccessMode(envSource?.VITE_ACCESS_MODE);
};

export const getAccessMode = (env) => {
  return validateAccessMode(env);
};

export const getEntryRouteForMode = (mode) => {
  if (mode === ACCESS_MODES.DEMO) {
    return "/access";
  }

  return "/role-switcher";
};
