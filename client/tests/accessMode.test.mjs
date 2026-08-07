import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AccessModeConfigurationScreen from "../src/components/shared/AccessModeConfigurationScreen.js";
import {
  ACCESS_MODES,
  AccessModeConfigurationError,
  configureAccessMode,
  getAccessMode,
  parseAccessMode,
  getEntryRouteForMode,
  validateAccessMode,
} from "../src/utils/accessMode.js";

const appRoutesSourcePath =
  new URL("../src/routes/AppRoutes.jsx", import.meta.url);

test("frontend access mode accepts DEVELOPMENT", () => {
  assert.equal(
    validateAccessMode({ VITE_ACCESS_MODE: ACCESS_MODES.DEVELOPMENT }),
    ACCESS_MODES.DEVELOPMENT,
  );
});

test("frontend access mode accepts DEMO", () => {
  assert.equal(
    validateAccessMode({ VITE_ACCESS_MODE: ACCESS_MODES.DEMO }),
    ACCESS_MODES.DEMO,
  );
});

test("frontend access mode parser follows the canonical matrix", () => {
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
    assert.equal(parseAccessMode(value), expected);
  });

  rejectedCases.forEach((value) => {
    assert.throws(
      () => parseAccessMode(value),
      (error) => {
        assert.equal(error instanceof AccessModeConfigurationError, true);
        assert.match(error.message, /DISTYNC frontend configuration error:/);
        assert.match(error.message, /VITE_ACCESS_MODE/);
        assert.match(error.message, /DEVELOPMENT/);
        assert.match(error.message, /DEMO/);
        assert.match(error.message, /exactly/);
        return true;
      },
    );
  });
});

test("frontend access mode rejects missing values without fallback", () => {
  assert.throws(() => validateAccessMode({}), /VITE_ACCESS_MODE/);
});

test("frontend access mode requires explicit configuration and rejects non-string values", () => {
  assert.throws(() => getAccessMode(), /VITE_ACCESS_MODE/);

  [true, false, {}, [], ["DEVELOPMENT"]].forEach((value) => {
    assert.throws(() => parseAccessMode(value), /VITE_ACCESS_MODE/);
  });

  configureAccessMode({ VITE_ACCESS_MODE: ACCESS_MODES.DEMO });
  assert.equal(getAccessMode(), ACCESS_MODES.DEMO);
});

test("entry route stays aligned with the validated access mode", () => {
  assert.equal(getEntryRouteForMode(ACCESS_MODES.DEVELOPMENT), "/role-switcher");
  assert.equal(getEntryRouteForMode(ACCESS_MODES.DEMO), "/access");
});

test("configuration error screen renders the required user guidance", () => {
  const markup = renderToStaticMarkup(
    React.createElement(AccessModeConfigurationScreen),
  );

  assert.match(markup, /DISTYNC configuration error/);
  assert.match(
    markup,
    /The application access mode is not configured correctly\./,
  );
  assert.match(
    markup,
    /Set VITE_ACCESS_MODE exactly to DEVELOPMENT or DEMO, then restart the application\./,
  );
  assert.doesNotMatch(markup, /role-switcher/i);
});

test("role switcher route stays gated behind development mode", async () => {
  const source = await fs.readFile(appRoutesSourcePath, "utf8");

  assert.match(
    source,
    /resolvedAccessMode === ACCESS_MODES\.DEVELOPMENT[\s\S]*<RoleSwitcherPage \/>/,
  );
  assert.match(
    source,
    /<Navigate to=\{getEntryRouteForMode\(resolvedAccessMode\)\} replace \/>/,
  );
});

test("the shared resolver is Vite-independent and the adapter owns import.meta.env", async () => {
  const resolverSource = await fs.readFile(
    new URL("../src/utils/accessMode.js", import.meta.url),
    "utf8",
  );
  const adapterSource = await fs.readFile(
    new URL("../src/config/clientEnv.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(resolverSource, /import\.meta|process\.env/);
  assert.match(adapterSource, /import\.meta\.env/);
  assert.match(adapterSource, /configureAccessMode/);
});
