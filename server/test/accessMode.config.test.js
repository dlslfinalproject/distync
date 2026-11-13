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

test("backend access mode parser follows the canonical matrix", () => {
  const acceptedCases = [
    ["DEVELOPMENT", ACCESS_MODES.DEVELOPMENT],
    ["DEMO", ACCESS_MODES.DEMO],
    [" DEVELOPMENT ", ACCESS_MODES.DEVELOPMENT],
    [" DEMO ", ACCESS_MODES.DEMO],
  ];
  const rejectedCases = [
    undefined,
    null,
    "",
    "   ",
    "development",
    "Development",
    "demo",
    "Demo",
    "PRODUCTION",
    "production",
    "DEV",
    "INVALID",
  ];

  acceptedCases.forEach(([value, expected]) => {
    assert.equal(parseServerAccessMode(value), expected);
  });

  rejectedCases.forEach((value) => {
    assert.throws(
      () => parseServerAccessMode(value),
      (error) => {
        assert.equal(error instanceof AccessModeConfigurationError, true);
        assert.match(error.message, /DISTYNC server configuration error:/);
        assert.match(error.message, /SERVER_ACCESS_MODE/);
        assert.match(error.message, /DEVELOPMENT/);
        assert.match(error.message, /DEMO/);
        assert.match(error.message, /exactly/);
        return true;
      },
    );
  });
});

test("backend access mode rejects missing values without fallback", () => {
  assert.throws(() => getServerAccessMode({}), /SERVER_ACCESS_MODE/);
});

test("backend ignores the removed ACCESS_MODE alias", () => {
  assert.throws(
    () => getServerAccessMode({ ACCESS_MODE: ACCESS_MODES.DEMO }),
    /SERVER_ACCESS_MODE/,
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
  assert.equal(parseDevelopmentBypassFlag("TRUE"), false);
  assert.equal(parseDevelopmentBypassFlag(" true "), false);
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
      ENABLE_DEVELOPMENT_AUTH_BYPASS: "TRUE",
    }),
    false,
  );
  assert.equal(
    isDevelopmentBypassEnabled({
      SERVER_ACCESS_MODE: ACCESS_MODES.DEMO,
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
