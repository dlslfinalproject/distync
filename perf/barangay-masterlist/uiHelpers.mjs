import { DEFAULT_TIMEOUT_MS } from "./config.mjs";

const PLACEHOLDER_EVENT_TEXTS = [
  "select active disaster event",
  "no disaster event selected",
  "select event",
  "loading...",
];

const elapsedSince = (startedAt) =>
  startedAt == null ? null : Math.round(performance.now() - startedAt);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitUntilElapsed = async (runStartedAt, minElapsedMs) => {
  if (runStartedAt == null || !Number.isFinite(minElapsedMs) || minElapsedMs <= 0) {
    return;
  }

  const remainingMs = minElapsedMs - elapsedSince(runStartedAt);

  if (remainingMs > 0) {
    await sleep(remainingMs);
  }
};

export const isPlaceholderEventText = (text) => {
  const normalized = String(text || "").trim().toLowerCase();

  return !normalized || PLACEHOLDER_EVENT_TEXTS.includes(normalized);
};

export const readSafeSessionSummary = async (page) =>
  page.evaluate(() => {
    const keys = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (key && key.startsWith("distync:") && key.endsWith(":auth-session")) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key));
        const user = parsed?.user;

        if (user?.role) {
          return {
            key,
            userId: user.id || "",
            role: user.role || "",
            name: user.name || user.full_name || "",
            emailDomain: user.email ? String(user.email).split("@")[1] || "" : "",
            defaultBarangayId: user.default_barangay_id || user.defaultBarangayId || "",
            barangayName:
              user.barangay?.name ||
              user.default_barangay?.name ||
              user.assigned_barangay?.name ||
              "",
          };
        }
      } catch (_error) {
        return null;
      }
    }

    return null;
  });

export const extractVisibleState = async (page) =>
  page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const registeredFamilyHeading = [...document.querySelectorAll("h3")].find(
      (heading) => heading.textContent?.trim() === "Registered Family",
    );
    const table = registeredFamilyHeading
      ? registeredFamilyHeading.closest("section")?.querySelector("table")
      : document.querySelector("table");
    const rowCount = table ? table.querySelectorAll("tbody tr").length : 0;
    const emptyState = /No matching records found|Please select a disaster event/i.test(
      bodyText,
    );
    const loading = /Loading masterlist data|Loading analytics/i.test(bodyText);
    const eventSelect = document.querySelector("#barangay-dashboard-event");
    const selectedEventOption =
      eventSelect instanceof HTMLSelectElement
        ? eventSelect.selectedOptions[0]
        : null;
    const selectedOptionText = selectedEventOption?.textContent?.trim() || "";
    const selectedOptionValue = selectedEventOption?.value || "";
    const barangayMatch = bodyText.match(/Assigned Barangay\s*[:\n]\s*([^\n]+)/i);

    return {
      rowCount,
      hasTable: Boolean(table),
      emptyState,
      loading,
      selectedEventText: selectedOptionText,
      selectedEventValue: selectedOptionValue,
      assignedBarangayText: barangayMatch?.[1]?.trim() || "",
      hasMasterlistHeading: /EVACUEE MASTERLIST MANAGEMENT/i.test(bodyText),
      hasRegisteredFamilyHeading: Boolean(registeredFamilyHeading),
      hasExportButton: [...document.querySelectorAll("button")].some((button) =>
        /export/i.test(button.textContent || button.getAttribute("aria-label") || ""),
      ),
      duplicateVisibleRecordCount: (() => {
        if (!table) {
          return 0;
        }

        const names = [...table.querySelectorAll("tbody tr td:nth-child(2)")]
          .map((cell) => cell.textContent?.trim())
          .filter(Boolean);
        return names.length - new Set(names).size;
      })(),
    };
  });

export const waitForResolvedEvent = async (
  page,
  { timeout = DEFAULT_TIMEOUT_MS, runStartedAt = null } = {},
) => {
  await page.waitForFunction(
    (placeholderTexts) => {
      const eventSelect = document.querySelector("#barangay-dashboard-event");

      if (!(eventSelect instanceof HTMLSelectElement)) {
        return false;
      }

      const selected = eventSelect.selectedOptions[0];
      const value = selected?.value || "";
      const text = selected?.textContent?.trim().toLowerCase() || "";

      return Boolean(value) && !placeholderTexts.includes(text);
    },
    PLACEHOLDER_EVENT_TEXTS,
    { timeout },
  );

  return elapsedSince(runStartedAt);
};

export const waitForMasterlistSettled = async (
  page,
  {
    timeout = DEFAULT_TIMEOUT_MS,
    runStartedAt = null,
    minElapsedMs = 0,
    expectedEventId = "",
    expectedFingerprint = null,
  } = {},
) => {
  const startedAt = performance.now();

  await waitUntilElapsed(runStartedAt, minElapsedMs);

  await page.waitForFunction(
    ({ placeholderTexts, expectedEventId, expectedFingerprint }) => {
      const text = document.body?.innerText || "";
      const eventSelect = document.querySelector("#barangay-dashboard-event");
      const selected = eventSelect instanceof HTMLSelectElement
        ? eventSelect.selectedOptions[0]
        : null;
      const selectedText = selected?.textContent?.trim().toLowerCase() || "";
      const selectedValue = selected?.value || "";
      const loading = /Loading masterlist data|Loading analytics/i.test(text);
      const rowCount = document.querySelectorAll("table tbody tr").length;
      const emptyState = /No matching records found/i.test(text);
      const hasAuthoritativeResult = rowCount > 0 || emptyState;
      const eventMatches = !expectedEventId || selectedValue === expectedEventId;
      const fingerprintMatches =
        !expectedFingerprint ||
        expectedFingerprint.rowCount == null ||
        (rowCount === expectedFingerprint.rowCount &&
          emptyState === Boolean(expectedFingerprint.emptyState));

      return (
        Boolean(selectedValue) &&
        eventMatches &&
        !placeholderTexts.includes(selectedText) &&
        !/No disaster event selected|Please select a disaster event/i.test(text) &&
        !loading &&
        Boolean(hasAuthoritativeResult) &&
        fingerprintMatches
      );
    },
    { placeholderTexts: PLACEHOLDER_EVENT_TEXTS, expectedEventId, expectedFingerprint },
    { timeout },
  );

  return runStartedAt == null
    ? Math.round(performance.now() - startedAt)
    : elapsedSince(runStartedAt);
};

export const waitForCriticalControls = async (
  page,
  { timeout = DEFAULT_TIMEOUT_MS, runStartedAt = null, minElapsedMs = 0 } = {},
) => {
  const startedAt = performance.now();

  await waitUntilElapsed(runStartedAt, minElapsedMs);

  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || "";

      if (/Loading masterlist data|Loading analytics/i.test(text)) {
        return false;
      }

      const controls = [...document.querySelectorAll("input, button, select")];
      const hasUsableEventSelector = controls.some(
        (control) =>
          control instanceof HTMLSelectElement &&
          control.id === "barangay-dashboard-event" &&
          !control.disabled,
      );
      const hasUsableExportButton = controls.some(
        (control) =>
          control instanceof HTMLButtonElement &&
          /export/i.test(control.textContent || control.getAttribute("aria-label") || "") &&
          !control.disabled,
      );

      return hasUsableEventSelector && hasUsableExportButton;
    },
    undefined,
    { timeout },
  );

  return runStartedAt == null
    ? Math.round(performance.now() - startedAt)
    : elapsedSince(runStartedAt);
};
