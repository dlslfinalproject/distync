const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACCESS_MODES,
  BUILD_TARGETS,
  resolveBuildTargetConfig,
  validateBuildTargetAccessMode,
} = require("../scripts/buildTargetConfig.cjs");

test("development build target resolves only to DEVELOPMENT", () => {
  const result = resolveBuildTargetConfig(BUILD_TARGETS.DEVELOPMENT);

  assert.equal(result.target, BUILD_TARGETS.DEVELOPMENT);
  assert.equal(result.accessMode, ACCESS_MODES.DEVELOPMENT);
  assert.equal(result.modeName, BUILD_TARGETS.DEVELOPMENT);
});

test("demo build target resolves only to DEMO", () => {
  const result = resolveBuildTargetConfig(BUILD_TARGETS.DEMO);

  assert.equal(result.target, BUILD_TARGETS.DEMO);
  assert.equal(result.accessMode, ACCESS_MODES.DEMO);
  assert.equal(result.modeName, BUILD_TARGETS.DEMO);
});

test("demo build rejects a DEVELOPMENT effective mode", () => {
  assert.throws(
    () =>
      validateBuildTargetAccessMode({
        requestedTarget: BUILD_TARGETS.DEMO,
        effectiveAccessMode: ACCESS_MODES.DEVELOPMENT,
      }),
    /DISTYNC demo build configuration error:/,
  );
});

test("development build rejects a DEMO effective mode", () => {
  assert.throws(
    () =>
      validateBuildTargetAccessMode({
        requestedTarget: BUILD_TARGETS.DEVELOPMENT,
        effectiveAccessMode: ACCESS_MODES.DEMO,
      }),
    /DISTYNC development build configuration error:/,
  );
});

test("unknown build target is rejected", () => {
  assert.throws(
    () => resolveBuildTargetConfig("official"),
    /build target must be exactly development or demo/,
  );
});

test("missing build target is rejected", () => {
  assert.throws(
    () => resolveBuildTargetConfig(undefined),
    /dedicated build target is required/,
  );
});

test("lowercase build target names are required exactly as scripted", () => {
  assert.throws(
    () => resolveBuildTargetConfig("Development"),
    /build target must be exactly development or demo/,
  );
});

test("matching target and access mode passes validation", () => {
  const result = validateBuildTargetAccessMode({
    requestedTarget: BUILD_TARGETS.DEMO,
    effectiveAccessMode: ACCESS_MODES.DEMO,
  });

  assert.equal(result.accessMode, ACCESS_MODES.DEMO);
});
