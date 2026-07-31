import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const validateConfiguredAccessMode = (value) => {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (normalizedValue === "DEVELOPMENT" || normalizedValue === "DEMO") {
    return normalizedValue;
  }

  throw new Error(
    "VITE_ACCESS_MODE must be set to DEVELOPMENT or DEMO.",
  );
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  validateConfiguredAccessMode(env.VITE_ACCESS_MODE);

  return {
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
                cacheName: "distync-pages",
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({ request }) =>
                ["script", "style", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "distync-shell",
              },
            },
            {
              urlPattern: ({ request }) =>
                ["image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "distync-static-assets",
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
