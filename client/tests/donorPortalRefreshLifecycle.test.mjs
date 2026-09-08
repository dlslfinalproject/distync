import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createDonationPortalRefreshCoordinator,
  PUBLIC_PORTAL_REFRESH_INTERVAL_MS,
} from "../src/features/donations/donationPortalRefreshCoordinator.mjs";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const flushMicrotasks = async () => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const createDocumentDouble = (initialVisibilityState = "visible") => {
  const listeners = new Set();
  const documentDouble = {
    visibilityState: initialVisibilityState,
    hidden: initialVisibilityState === "hidden",
    addEventListener(type, listener) {
      if (type === "visibilitychange") {
        listeners.add(listener);
      }
    },
    removeEventListener(type, listener) {
      if (type === "visibilitychange") {
        listeners.delete(listener);
      }
    },
    setVisibility(nextVisibilityState) {
      documentDouble.visibilityState = nextVisibilityState;
      documentDouble.hidden = nextVisibilityState === "hidden";
      [...listeners].forEach((listener) => listener());
    },
    get listenerCount() {
      return listeners.size;
    },
  };

  return documentDouble;
};

const createIntervalDouble = () => {
  let nextId = 1;
  const timers = new Map();
  const createdTimers = new Map();
  const clearedIds = [];

  return {
    setInterval(callback, intervalMs) {
      const id = nextId;
      nextId += 1;
      const timer = { callback, intervalMs };
      timers.set(id, timer);
      createdTimers.set(id, timer);
      return id;
    },
    clearInterval(id) {
      clearedIds.push(id);
      timers.delete(id);
    },
    fire(id) {
      timers.get(id)?.callback();
    },
    fireCreated(id) {
      createdTimers.get(id)?.callback();
    },
    fireActive() {
      [...timers.values()].forEach(({ callback }) => callback());
    },
    get activeIds() {
      return [...timers.keys()];
    },
    get created() {
      return [...createdTimers.entries()];
    },
    clearedIds,
  };
};

const createHarness = ({ visibilityState = "visible", load, onRequestSuccess, onRequestError } = {}) => {
  const documentDouble = createDocumentDouble(visibilityState);
  const intervalDouble = createIntervalDouble();
  const calls = [];
  const successes = [];
  const errors = [];

  const coordinator = createDonationPortalRefreshCoordinator({
    documentObject: documentDouble,
    setIntervalFn: intervalDouble.setInterval,
    clearIntervalFn: intervalDouble.clearInterval,
    load:
      load ||
      (async (meta) => {
        calls.push(meta);
        return { requestId: meta.requestId };
      }),
    onRequestSuccess: (data, meta) => {
      successes.push({ data, meta });
      return onRequestSuccess?.(data, meta);
    },
    onRequestError: (error, meta) => {
      errors.push({ error, meta });
      return onRequestError?.(error, meta);
    },
  });

  return {
    calls,
    coordinator,
    documentDouble,
    errors,
    intervalDouble,
    successes,
  };
};

test("public donor page uses the unchanged endpoint and the local refresh coordinator", async () => {
  const [pageSource, serviceSource, routesSource] = await Promise.all([
    fs.readFile(sourcePath("pages", "donor", "DonationInformationPage.jsx"), "utf8"),
    fs.readFile(sourcePath("features", "donations", "donationService.js"), "utf8"),
    fs.readFile(sourcePath("routes", "AppRoutes.jsx"), "utf8"),
  ]);

  assert.match(pageSource, /createDonationPortalRefreshCoordinator/);
  assert.match(pageSource, /refreshIntervalMs: PUBLIC_PORTAL_REFRESH_INTERVAL_MS/);
  assert.match(pageSource, /fetchDonationPortalData\(\{ signal \}\)/);
  assert.doesNotMatch(pageSource, /addEventListener\("focus"/);
  assert.match(serviceSource, /\/api\/v1\/donations\/public-portal/);
  assert.match(serviceSource, /const \{ signal, \.\.\.queryFilters \} = filters \|\| \{\}/);
  assert.match(serviceSource, /signal \? await fetch\(url, \{ signal \}\) : await fetch\(url\)/);
  assert.match(routesSource, /path: "\/donations", element: <DonationInformationPage \/>/);
  assert.match(routesSource, /path: "\/donor\/information", element: <DonationInformationPage \/>/);
});

test("visible mount performs one request and preserves the 60-second cadence", async () => {
  const requests = [];
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return { requestId: meta.requestId };
    },
  });

  harness.coordinator.start();

  assert.equal(requests.length, 1);
  assert.equal(harness.intervalDouble.created.length, 1);
  assert.equal(
    harness.intervalDouble.created[0][1].intervalMs,
    PUBLIC_PORTAL_REFRESH_INTERVAL_MS,
  );

  await flushMicrotasks();
  harness.intervalDouble.fireActive();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].isInitialRequest, true);
  assert.equal(requests[1].reason, "timer");

  harness.coordinator.stop();
});

test("hidden mount and hidden timer ticks issue zero network requests", () => {
  const requests = [];
  const harness = createHarness({
    visibilityState: "hidden",
    load: async (meta) => {
      requests.push(meta);
      return null;
    },
  });

  harness.coordinator.start();
  harness.intervalDouble.fireActive();
  harness.intervalDouble.fireActive();
  harness.intervalDouble.fireActive();

  assert.equal(requests.length, 0);
  assert.equal(harness.coordinator.getState().intervalActive, true);

  harness.coordinator.stop();
});

test("a hidden-to-visible transition performs one authoritative refresh and resets the timer", async () => {
  const requests = [];
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return null;
    },
  });

  harness.coordinator.start();
  await flushMicrotasks();
  const initialTimerId = harness.intervalDouble.activeIds[0];

  harness.documentDouble.setVisibility("hidden");
  harness.intervalDouble.fire(initialTimerId);
  harness.documentDouble.setVisibility("visible");
  harness.documentDouble.setVisibility("visible");

  assert.equal(requests.length, 2);
  assert.equal(requests[1].reason, "visibility");
  assert.deepEqual(harness.intervalDouble.activeIds, [initialTimerId + 1]);
  assert.deepEqual(harness.intervalDouble.clearedIds, [initialTimerId]);

  harness.coordinator.stop();
});

test("concurrent timer and visibility triggers share one request and queue at most one trailing refresh", async () => {
  const requests = [];
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  const thirdRequest = createDeferred();
  const pendingResponses = [firstRequest, secondRequest, thirdRequest];
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return pendingResponses[requests.length - 1].promise;
    },
  });

  harness.coordinator.start();
  harness.coordinator.requestRefresh("timer");
  harness.coordinator.requestRefresh("visibility");
  harness.coordinator.requestRefresh("timer");

  assert.equal(requests.length, 1);
  assert.equal(harness.coordinator.getState().trailingRefreshPending, true);

  firstRequest.resolve({ generation: 1 });
  await flushMicrotasks();
  assert.equal(requests.length, 2);

  harness.coordinator.requestRefresh("timer");
  harness.coordinator.requestRefresh("visibility");
  harness.coordinator.requestRefresh("visibility");
  assert.equal(requests.length, 2);

  secondRequest.resolve({ generation: 2 });
  await flushMicrotasks();
  assert.equal(requests.length, 3);
  assert.equal(requests[1].reason, "trailing");
  assert.equal(requests[2].reason, "trailing");

  thirdRequest.resolve({ generation: 3 });
  await flushMicrotasks();
  assert.equal(harness.coordinator.getState().trailingRefreshPending, false);
  harness.coordinator.stop();
});

test("visibility return during an active request never creates a concurrent duplicate", async () => {
  let activeRequests = 0;
  let maximumActiveRequests = 0;
  const requests = [];
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  const responses = [firstRequest, secondRequest];
  const harness = createHarness({
    load: async (meta) => {
      activeRequests += 1;
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
      requests.push(meta);
      const response = await responses[requests.length - 1].promise;
      activeRequests -= 1;
      return response;
    },
  });

  harness.coordinator.start();
  harness.documentDouble.setVisibility("hidden");
  harness.documentDouble.setVisibility("visible");
  harness.documentDouble.setVisibility("visible");

  assert.equal(requests.length, 1);
  assert.equal(maximumActiveRequests, 1);

  firstRequest.resolve({ generation: 1 });
  await flushMicrotasks();
  assert.equal(requests.length, 2);
  assert.equal(maximumActiveRequests, 1);

  secondRequest.resolve({ generation: 2 });
  await flushMicrotasks();
  harness.coordinator.stop();
});

test("an older response cannot update state after a newer request generation starts", async () => {
  const applied = [];
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  let requestNumber = 0;
  const harness = createHarness({
    load: async () => {
      requestNumber += 1;
      return (requestNumber === 1 ? firstRequest : secondRequest).promise;
    },
    onRequestSuccess: (data) => {
      applied.push(data);
    },
  });

  harness.coordinator.start();
  harness.coordinator.stop();
  harness.coordinator.start();

  assert.equal(harness.coordinator.getState().requestSequence, 2);
  secondRequest.resolve("newer");
  await flushMicrotasks();
  firstRequest.resolve("older");
  await flushMicrotasks();

  assert.deepEqual(applied, ["newer"]);
  harness.coordinator.stop();
});

test("unmount aborts the active request and ignores the intentional AbortError", async () => {
  const abortErrors = [];
  let requestSignal;
  const harness = createHarness({
    load: ({ signal }) => {
      requestSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("request aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
    onRequestError: (error) => {
      abortErrors.push(error);
    },
  });

  harness.coordinator.start();
  harness.coordinator.stop();
  await flushMicrotasks();

  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(abortErrors, []);
  assert.equal(harness.coordinator.getState().mounted, false);
});

test("real failures notify the page, release the gate, preserve one-request concurrency, and allow the next tick to retry", async () => {
  const requests = [];
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return (requests.length === 1 ? firstRequest : secondRequest).promise;
    },
  });

  harness.coordinator.start();
  firstRequest.reject(new Error("synthetic network failure"));
  await flushMicrotasks();

  assert.equal(requests.length, 1);
  assert.equal(harness.errors.length, 1);
  assert.match(harness.errors[0].error.message, /synthetic network failure/);
  assert.equal(harness.coordinator.getState().currentRequestId, null);

  harness.intervalDouble.fireActive();
  assert.equal(requests.length, 2);
  secondRequest.resolve({ ok: true });
  await flushMicrotasks();
  assert.equal(harness.coordinator.getState().currentRequestId, null);

  harness.coordinator.stop();
});

test("a pending overlap after a real failure runs only one trailing refresh", async () => {
  const requests = [];
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return (requests.length === 1 ? firstRequest : secondRequest).promise;
    },
  });

  harness.coordinator.start();
  harness.coordinator.requestRefresh("visibility");
  firstRequest.reject(new Error("first request failed"));
  await flushMicrotasks();

  assert.equal(requests.length, 2);
  assert.equal(requests[1].reason, "trailing");

  secondRequest.resolve({ ok: true });
  await flushMicrotasks();
  assert.equal(requests.length, 2);
  harness.coordinator.stop();
});

test("background refresh failures do not require discarding previously applied data", async () => {
  let data = "initial data";
  let errorCount = 0;
  const firstRequest = createDeferred();
  const secondRequest = createDeferred();
  let requestNumber = 0;
  const harness = createHarness({
    load: async () => {
      requestNumber += 1;
      return (requestNumber === 1 ? firstRequest : secondRequest).promise;
    },
    onRequestSuccess: (nextData) => {
      data = nextData;
    },
    onRequestError: () => {
      errorCount += 1;
    },
  });

  harness.coordinator.start();
  firstRequest.resolve("loaded portal data");
  await flushMicrotasks();
  harness.intervalDouble.fireActive();
  secondRequest.reject(new Error("background failure"));
  await flushMicrotasks();

  assert.equal(data, "loaded portal data");
  assert.equal(errorCount, 1);
  harness.coordinator.stop();
});

test("timer and visibility listener cleanup prevents all future requests after unmount", async () => {
  const requests = [];
  const harness = createHarness({
    load: async (meta) => {
      requests.push(meta);
      return null;
    },
  });

  harness.coordinator.start();
  await flushMicrotasks();
  const oldTimerId = harness.intervalDouble.activeIds[0];
  assert.equal(harness.documentDouble.listenerCount, 1);

  harness.coordinator.stop();
  harness.intervalDouble.fireCreated(oldTimerId);
  harness.documentDouble.setVisibility("hidden");
  harness.documentDouble.setVisibility("visible");

  assert.equal(requests.length, 1);
  assert.equal(harness.intervalDouble.activeIds.length, 0);
  assert.equal(harness.documentDouble.listenerCount, 0);
});
