import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const clientRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("Mayor anomaly page renders through the Vite JSX transform", async (t) => {
  const vite = await createServer({
    root: clientRoot,
    configFile: false,
    server: { middlewareMode: true },
    appType: "spa",
  });

  t.after(async () => {
    await vite.close();
  });

  const { default: MayorAnomalyTrackingPage } = await vite.ssrLoadModule(
    "/src/pages/inventory/MayorAnomalyTrackingPage.jsx",
  );

  let markup;
  assert.doesNotThrow(() => {
    markup = renderToStaticMarkup(
      React.createElement(MayorAnomalyTrackingPage),
    );
  }, "the Mayor anomaly route component must render without a runtime exception");

  assert.match(markup, /Anomaly Tracking/);
  assert.match(markup, /Anomaly Records/);
});
