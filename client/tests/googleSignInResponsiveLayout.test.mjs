import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  getGoogleButtonWidth,
  measureGoogleButtonWidth,
} from "../src/features/auth/googleButtonSizing.js";

const accessStylesPath = new URL(
  "../src/components/access/accessPage.css",
  import.meta.url,
);
const accessPageSourcePath = new URL("../src/pages/AccessPage.jsx", import.meta.url);
const authServiceSourcePath = new URL(
  "../src/features/auth/authService.js",
  import.meta.url,
);

test("Google button widths stay within provider-supported bounds", () => {
  assert.equal(getGoogleButtonWidth(520), 400);
  assert.equal(getGoogleButtonWidth(396.9), 396);
  assert.equal(getGoogleButtonWidth(320), 320);
  assert.equal(getGoogleButtonWidth(190), 200);
  assert.equal(getGoogleButtonWidth(0), 0);
  assert.equal(getGoogleButtonWidth("not-a-width"), 0);
});

test("Google button measurement prefers the rendered container width", () => {
  const element = {
    clientWidth: 334,
    getBoundingClientRect: () => ({ width: 390 }),
  };

  assert.equal(measureGoogleButtonWidth(element), 334);
});

test("the auth panel accounts for its padding instead of expanding past the shell", async () => {
  const source = await fs.readFile(accessStylesPath, "utf8");
  const authPanelStyles = source.match(
    /\.distync-access-page__auth-panel\s*\{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(authPanelStyles);
  assert.match(authPanelStyles, /box-sizing:\s*border-box/);
  assert.match(authPanelStyles, /min-width:\s*0/);
  assert.match(authPanelStyles, /overflow:\s*visible/);
});

test("the Google wrapper is responsive without overriding provider-owned markup", async () => {
  const source = await fs.readFile(accessStylesPath, "utf8");
  const googleButtonStyles = source.match(
    /\.distync-access-page__google-button\s*\{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(googleButtonStyles);
  assert.match(googleButtonStyles, /width:\s*min\(400px,\s*100%\)/);
  assert.match(googleButtonStyles, /max-width:\s*100%/);
  assert.match(googleButtonStyles, /min-width:\s*0/);
  assert.doesNotMatch(
    source,
    /\.distync-access-page__google-button\s+(?:>\s*div|iframe)/,
  );
  assert.doesNotMatch(source, /transform:\s*scale\(/);
});

test("Google rendering remeasures on layout changes without reinitializing auth", async () => {
  const [accessPageSource, authServiceSource] = await Promise.all([
    fs.readFile(accessPageSourcePath, "utf8"),
    fs.readFile(authServiceSourcePath, "utf8"),
  ]);

  assert.match(accessPageSource, /new ResizeObserver\(queueGoogleButtonSetup\)/);
  assert.match(accessPageSource, /orientationchange/);
  assert.match(accessPageSource, /let isRendering = false/);
  assert.match(accessPageSource, /childElementCount > 0/);
  assert.match(authServiceSource, /measureGoogleButtonWidth\(element\)/);
  assert.match(authServiceSource, /if \(initializedGoogleClientId !== clientId\)/);
  assert.match(authServiceSource, /isActive = \(\) => true/);
});
