import path from "node:path";

export const FRONTEND_URL =
  process.env.DISTYNC_PERF_FRONTEND_URL || "https://distync.onrender.com";
export const BACKEND_URL =
  process.env.DISTYNC_PERF_BACKEND_URL ||
  "https://distync-api-test.onrender.com";

export const APPROVED_FRONTEND_HOSTS = new Set(["distync.onrender.com"]);
export const APPROVED_BACKEND_HOSTS = new Set(["distync-api-test.onrender.com"]);

export const STORAGE_STATE_PATH = path.resolve(
  ".performance-auth",
  "barangay-storage-state.json",
);

export const RESULTS_ROOT = path.resolve(
  "performance-results",
  "barangay-masterlist",
);

export const MASTERLIST_PATH = "/barangay/masterlist";
export const DEFAULT_TIMEOUT_MS = Number(
  process.env.DISTYNC_PERF_TIMEOUT_MS || 30000,
);
export const WARM_REFRESH_SAMPLES = Number(
  process.env.DISTYNC_PERF_WARM_RUNS ||
    process.env.DISTYNC_PERF_WARM_REFRESH_SAMPLES ||
    20,
);
export const HARD_REFRESH_SAMPLES = Number(
  process.env.DISTYNC_PERF_HARD_RUNS ||
    process.env.DISTYNC_PERF_HARD_REFRESH_SAMPLES ||
    5,
);
export const EVENT_SWITCH_SAMPLES = Number(
  process.env.DISTYNC_PERF_EVENT_SWITCH_SAMPLES || 3,
);
export const RAPID_SWITCH_SAMPLES = Number(
  process.env.DISTYNC_PERF_RAPID_SWITCH_SAMPLES || 2,
);
export const PAUSE_BETWEEN_RUNS_MS = Number(
  process.env.DISTYNC_PERF_PAUSE_MS || 3000,
);

export const MASTERLIST_WARNING_MS = Number(
  process.env.DISTYNC_PERF_MASTERLIST_WARNING_MS || 3000,
);
export const UI_WARNING_MS = Number(process.env.DISTYNC_PERF_UI_WARNING_MS || 5000);
export const ALLOW_MUTATIONS =
  process.env.DISTYNC_PERF_ALLOW_MUTATIONS === "true";

export const assertApprovedTargets = () => {
  const frontend = new URL(FRONTEND_URL);
  const backend = new URL(BACKEND_URL);

  if (!APPROVED_FRONTEND_HOSTS.has(frontend.host)) {
    throw new Error(
      `Refusing to run against unapproved frontend host: ${frontend.host}`,
    );
  }

  if (!APPROVED_BACKEND_HOSTS.has(backend.host)) {
    throw new Error(`Refusing to run against unapproved backend host: ${backend.host}`);
  }
};

export const buildMasterlistUrl = () =>
  new URL(MASTERLIST_PATH, FRONTEND_URL).toString();
