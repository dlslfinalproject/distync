import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedWorkerPath = path.join(clientDirectory, "dist", "sw.js");

const buildDemoWorker = () => {
  execFileSync(process.execPath, ["scripts/buildWithAccessMode.cjs", "demo"], {
    cwd: clientDirectory,
    env: {
      ...process.env,
      VITE_API_BASE_URL: "https://example.invalid",
      VITE_GOOGLE_CLIENT_ID: "audit-placeholder.apps.googleusercontent.com",
    },
    stdio: "ignore",
  });
};

const loadGeneratedRoutes = (workerSource) => {
  const routes = [];
  const workbox = {
    setCacheNameDetails: (details) => {
      workbox.cachePrefix = details.prefix;
    },
    skipWaiting: () => {},
    clientsClaim: () => {},
    precacheAndRoute: (entries) => {
      const entryUrls = new Set(entries.map(({ url }) => new URL(url, "https://distync.onrender.com/").pathname));
      routes.push({
        name: "precache",
        matches: ({ request }) => entryUrls.has(new URL(request.url).pathname),
        handle: async ({ request, caches }) => caches.match(request.url),
      });
    },
    cleanupOutdatedCaches: () => {},
    registerRoute: (matcher, strategy, method = "GET") => {
      routes.push({ name: "runtime", matcher, strategy, method });
    },
    NavigationRoute: class {},
    createHandlerBoundToURL: () => async () => {},
    NetworkOnly: class {},
    NetworkFirst: class {},
    StaleWhileRevalidate: class {},
    CacheFirst: class {},
    ExpirationPlugin: class {},
  };

  const define = (_dependencies, factory) => factory(workbox);
  const serviceWorkerGlobal = {
    define,
    skipWaiting: () => {},
    clientsClaim: () => {},
  };
  new Function("self", "define", workerSource)(
    serviceWorkerGlobal,
    define,
  );
  return routes;
};

test("generated DEMO worker serves a cached logo before any runtime fallback", async () => {
  if (!existsSync(generatedWorkerPath)) {
    buildDemoWorker();
  }
  assert.equal(existsSync(generatedWorkerPath), true);

  const workerSource = readFileSync(generatedWorkerPath, "utf8");
  const routes = loadGeneratedRoutes(workerSource);
  const logoNames = ["distync-logo.png", "distync-logo-cropped.png"];
  const cacheEntries = new Map(
    logoNames.map((logoName) => [
      `https://distync.onrender.com/assets/${logoName}`,
      new Response(Buffer.from("valid-png"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    ]),
  );
  let networkAttempts = 0;
  const caches = {
    match: async (url) => cacheEntries.get(url),
  };

  for (const logoName of logoNames) {
    const logoRequest = new Request(`https://distync.onrender.com/assets/${logoName}`, {
      destination: "image",
    });
    const winningRoute = routes.find((route) =>
      route.matches({ request: logoRequest, url: new URL(logoRequest.url) }),
    );
    assert.equal(winningRoute?.name, "precache");

    const response = await winningRoute.handle({ request: logoRequest, caches });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
  }
  assert.equal(networkAttempts, 0);
  for (const logoName of logoNames) {
    assert.match(workerSource, new RegExp(logoName.replace(".", "\\.")));
  }
});
