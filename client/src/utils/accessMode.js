export const ACCESS_MODES = {
  DEVELOPMENT: "DEVELOPMENT",
  DEMO: "DEMO",
  PRODUCTION: "PRODUCTION",
};

const validAccessModes = Object.values(ACCESS_MODES);

export const getAccessMode = () => {
  const configuredMode = import.meta.env.VITE_ACCESS_MODE;

  if (validAccessModes.includes(configuredMode)) {
    return configuredMode;
  }

  return ACCESS_MODES.DEVELOPMENT;
};

export const getEntryRouteForMode = (mode) => {
  if (mode === ACCESS_MODES.DEMO || mode === ACCESS_MODES.PRODUCTION) {
    return "/access";
  }

  return "/role-switcher";
};
