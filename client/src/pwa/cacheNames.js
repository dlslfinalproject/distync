import { ACCESS_MODES } from "../utils/accessMode.js";

export const DISTYNC_CACHE_BASE_NAMES = {
  PAGES: "pages",
  SHELL: "shell",
  STATIC_ASSETS: "static-assets",
};

export const LEGACY_DISTYNC_CACHE_NAMES = [
  "distync-pages",
  "distync-shell",
  "distync-static-assets",
];

export const getModeCachePrefix = (mode) => {
  return `distync-${mode}`;
};

export const getModeCacheNameForAccessMode = (baseName, mode) => {
  return `${getModeCachePrefix(mode)}-${baseName}`;
};

export const buildModeRuntimeCacheNames = (mode) => {
  return [
    getModeCacheNameForAccessMode(DISTYNC_CACHE_BASE_NAMES.PAGES, mode),
    getModeCacheNameForAccessMode(DISTYNC_CACHE_BASE_NAMES.SHELL, mode),
    getModeCacheNameForAccessMode(DISTYNC_CACHE_BASE_NAMES.STATIC_ASSETS, mode),
  ];
};

export const buildAllModeRuntimeCacheNames = () => {
  return Object.values(ACCESS_MODES).flatMap((mode) =>
    buildModeRuntimeCacheNames(mode),
  );
};

export const getModePrecacheCacheId = (mode) => {
  return getModeCachePrefix(mode);
};

export const getKnownLegacyCacheNamesForCleanup = () => {
  return LEGACY_DISTYNC_CACHE_NAMES;
};

export const getKnownObsoleteCacheNames = ({
  previousMode,
  currentMode,
}) => {
  const obsoleteCacheNames = new Set(getKnownLegacyCacheNamesForCleanup());

  if (previousMode && previousMode !== currentMode) {
    buildModeRuntimeCacheNames(previousMode).forEach((cacheName) =>
      obsoleteCacheNames.add(cacheName),
    );
  }

  return Array.from(obsoleteCacheNames);
};
