import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AccessModeConfigurationScreen from "../src/components/shared/AccessModeConfigurationScreen.js";
import {
  ACCESS_MODES,
  AccessModeConfigurationError,
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

test("frontend access mode rejects missing values", () => {
  assert.throws(
    () => validateAccessMode({}),
    (error) => {
      assert.equal(error instanceof AccessModeConfigurationError, true);
      assert.match(error.message, /VITE_ACCESS_MODE/);
      assert.match(error.message, /DEVELOPMENT/);
      assert.match(error.message, /DEMO/);
      return true;
    },
  );
});

test("frontend access mode rejects empty values", () => {
  assert.throws(
    () => validateAccessMode({ VITE_ACCESS_MODE: "   " }),
    /VITE_ACCESS_MODE must be set to DEVELOPMENT or DEMO/,
  );
});

test("frontend access mode rejects invalid values without fallback", () => {
  assert.throws(
    () => validateAccessMode({ VITE_ACCESS_MODE: "INVALID" }),
    /VITE_ACCESS_MODE must be set to DEVELOPMENT or DEMO/,
  );
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
    /Set VITE_ACCESS_MODE to DEVELOPMENT or DEMO, then restart the application\./,
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
