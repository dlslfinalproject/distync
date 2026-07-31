const ACCESS_MODES = {
  DEVELOPMENT: "DEVELOPMENT",
  DEMO: "DEMO",
};

const BUILD_TARGETS = {
  DEVELOPMENT: "development",
  DEMO: "demo",
};

const validateBuildTarget = (value) => {
  if (value === BUILD_TARGETS.DEVELOPMENT) {
    return {
      target: BUILD_TARGETS.DEVELOPMENT,
      accessMode: ACCESS_MODES.DEVELOPMENT,
      label: "DEVELOPMENT",
      modeName: BUILD_TARGETS.DEVELOPMENT,
    };
  }

  if (value === BUILD_TARGETS.DEMO) {
    return {
      target: BUILD_TARGETS.DEMO,
      accessMode: ACCESS_MODES.DEMO,
      label: "DEMO",
      modeName: BUILD_TARGETS.DEMO,
    };
  }

  throw new Error(
    "DISTYNC frontend build configuration error: build target must be exactly development or demo.",
  );
};

const resolveBuildTargetConfig = (value) => {
  if (typeof value !== "string" || !value) {
    throw new Error(
      "DISTYNC frontend build configuration error: a dedicated build target is required.",
    );
  }

  return validateBuildTarget(value);
};

const validateBuildTargetAccessMode = ({
  requestedTarget,
  effectiveAccessMode,
}) => {
  const targetConfig = resolveBuildTargetConfig(requestedTarget);

  if (effectiveAccessMode === targetConfig.accessMode) {
    return targetConfig;
  }

  if (targetConfig.target === BUILD_TARGETS.DEMO) {
    throw new Error(
      "DISTYNC demo build configuration error: The demo build requires VITE_ACCESS_MODE=DEMO. Development access cannot be included in an official demo build.",
    );
  }

  throw new Error(
    "DISTYNC development build configuration error: The development build requires VITE_ACCESS_MODE=DEVELOPMENT.",
  );
};

module.exports = {
  ACCESS_MODES,
  BUILD_TARGETS,
  resolveBuildTargetConfig,
  validateBuildTargetAccessMode,
};
