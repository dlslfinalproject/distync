const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACCESS_MODES,
  AccessModeConfigurationError,
  getServerAccessMode,
  isDevelopmentBypassEnabled,
  parseDevelopmentBypassFlag,
  parseServerAccessMode,
} = require("../src/config/accessMode");

test("backend access mode accepts DEVELOPMENT", () => {
  assert.equal(
    parseServerAccessMode(ACCESS_MODES.DEVELOPMENT),
    ACCESS_MODES.DEVELOPMENT,
  );
});

test("backend access mode accepts DEMO", () => {
  assert.equal(parseServerAccessMode(ACCESS_MODES.DEMO), ACCESS_MODES.DEMO);
});

test("backend access mode rejects missing values", () => {
  assert.throws(
    () => getServerAccessMode({}),
    (error) => {
      assert.equal(error instanceof AccessModeConfigurationError, true);
      assert.match(error.message, /SERVER_ACCESS_MODE/);
      assert.match(error.message, /DEVELOPMENT/);
      assert.match(error.message, /DEMO/);
      return true;
    },
  );
});

test("backend access mode rejects empty values", () => {
  assert.throws(
    () => getServerAccessMode({ SERVER_ACCESS_MODE: "   " }),
    /SERVER_ACCESS_MODE must be set to DEVELOPMENT or DEMO/,
  );
});

test("backend access mode rejects invalid values without fallback", () => {
  assert.throws(
    () => getServerAccessMode({ SERVER_ACCESS_MODE: "INVALID" }),
    /SERVER_ACCESS_MODE must be set to DEVELOPMENT or DEMO/,
  );
});

test("development bypass flag defaults to false when missing", () => {
  assert.equal(parseDevelopmentBypassFlag(undefined), false);
  assert.equal(
    isDevelopmentBypassEnabled({ SERVER_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT }),
    false,
  );
});

test("development bypass flag treats false and invalid values as disabled", () => {
  assert.equal(parseDevelopmentBypassFlag("false"), false);
  assert.equal(parseDevelopmentBypassFlag("invalid"), false);
  assert.equal(
    isDevelopmentBypassEnabled({
      SERVER_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT,
      ENABLE_DEVELOPMENT_AUTH_BYPASS: "false",
    }),
    false,
  );
  assert.equal(
    isDevelopmentBypassEnabled({
      SERVER_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT,
      ENABLE_DEVELOPMENT_AUTH_BYPASS: "invalid",
    }),
    false,
  );
});

test("development bypass flag enables only exact true in development mode", () => {
  assert.equal(parseDevelopmentBypassFlag("true"), true);
  assert.equal(
    isDevelopmentBypassEnabled({
      SERVER_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT,
      ENABLE_DEVELOPMENT_AUTH_BYPASS: "true",
    }),
    true,
  );
  assert.equal(
    isDevelopmentBypassEnabled({
      SERVER_ACCESS_MODE: ACCESS_MODES.DEMO,
      ENABLE_DEVELOPMENT_AUTH_BYPASS: "true",
    }),
    false,
  );
});
