import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json";
import {
  validateBuildTargetAccessMode,
} from "./scripts/buildTargetConfig.cjs";
import {
  DISTYNC_CACHE_BASE_NAMES,
  getModeCacheNameForAccessMode,
  getModePrecacheCacheId,
} from "./src/pwa/cacheNames.js";

const validateConfiguredAccessMode = (value) => {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (normalizedValue === "DEVELOPMENT" || normalizedValue === "DEMO") {
    return normalizedValue;
  }

  throw new Error(
    "DISTYNC frontend configuration error: VITE_ACCESS_MODE must be set exactly to DEVELOPMENT or DEMO.",
  );
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredAccessMode = validateConfiguredAccessMode(env.VITE_ACCESS_MODE);

  if (process.env.DISTYNC_BUILD_TARGET) {
    validateBuildTargetAccessMode({
      requestedTarget: process.env.DISTYNC_BUILD_TARGET,
      effectiveAccessMode: configuredAccessMode,
    });
  }

  return {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "DISTYNC",
          short_name: "DISTYNC",
          description:
            "Disaster relief management system for LGU offices in Malvar, Batangas.",
          theme_color: "#17324d",
          background_color: "#edf4fb",
          display: "standalone",
          start_url: "/",
        },
        workbox: {
          cacheId: getModePrecacheCacheId(configuredAccessMode),
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: getModeCacheNameForAccessMode(
                  DISTYNC_CACHE_BASE_NAMES.PAGES,
                  configuredAccessMode,
                ),
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({ request }) =>
                ["script", "style", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: getModeCacheNameForAccessMode(
                  DISTYNC_CACHE_BASE_NAMES.SHELL,
                  configuredAccessMode,
                ),
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.includes(
                  "/storage/v1/object/sign/distync-profile-pictures/",
                ),
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request }) =>
                ["image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: getModeCacheNameForAccessMode(
                  DISTYNC_CACHE_BASE_NAMES.STATIC_ASSETS,
                  configuredAccessMode,
                ),
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
