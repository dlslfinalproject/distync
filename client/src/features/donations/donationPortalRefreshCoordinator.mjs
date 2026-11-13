export const PUBLIC_PORTAL_REFRESH_INTERVAL_MS = 60_000;

const getDefaultDocument = () =>
  typeof document === "undefined" ? undefined : document;

const isAbortError = (error) =>
  error?.name === "AbortError" || error?.code === 20;

const getVisibilityState = (documentObject) => {
  if (!documentObject) {
    return "visible";
  }

  if (typeof documentObject.visibilityState === "string") {
    return documentObject.visibilityState;
  }

  return documentObject.hidden ? "hidden" : "visible";
};

export const createDonationPortalRefreshCoordinator = ({
  load,
  onRequestStart,
  onRequestSuccess,
  onRequestError,
  documentObject = getDefaultDocument(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  refreshIntervalMs = PUBLIC_PORTAL_REFRESH_INTERVAL_MS,
}) => {
  if (typeof load !== "function") {
    throw new TypeError("Donation portal refresh coordinator requires a load function");
  }

  let mounted = false;
  let intervalId = null;
  let currentRequest = null;
  let trailingRefreshPending = false;
  let requestSequence = 0;
  let lastVisibilityState = getVisibilityState(documentObject);

  const isVisible = () =>
    getVisibilityState(documentObject) === "visible" &&
    documentObject?.hidden !== true;

  const isCurrentRequest = (requestId) =>
    mounted && currentRequest?.requestId === requestId;

  const createRequestController = () => {
    if (typeof AbortController !== "function") {
      return null;
    }

    return new AbortController();
  };

  const handleTimer = () => {
    if (!mounted || !isVisible()) {
      return;
    }

    void requestRefresh("timer");
  };

  const resetTimer = () => {
    if (!mounted) {
      return;
    }

    if (intervalId !== null) {
      clearIntervalFn(intervalId);
    }

    intervalId = setIntervalFn(handleTimer, refreshIntervalMs);
  };

  const startRequest = (reason) => {
    const requestId = ++requestSequence;
    const controller = createRequestController();
    const meta = {
      reason,
      requestId,
      isInitialRequest: requestId === 1,
      signal: controller?.signal,
      startedAt: Date.now(),
    };

    let outcome = "pending";
    currentRequest = { controller, requestId };

    onRequestStart?.(meta);

    if (!isCurrentRequest(requestId)) {
      return Promise.resolve("stopped");
    }

    const runRequest = async () => {
      try {
        const data = await load(meta);

        if (!isCurrentRequest(requestId)) {
          outcome = "stale";
          return outcome;
        }

        outcome = "fulfilled";
        await onRequestSuccess?.(data, meta);
        return outcome;
      } catch (error) {
        const aborted = Boolean(controller?.signal?.aborted) || isAbortError(error);

        outcome = aborted ? "aborted" : "rejected";

        if (isCurrentRequest(requestId) && !aborted) {
          await onRequestError?.(error, meta);
        }

        return outcome;
      } finally {
        if (currentRequest?.requestId !== requestId) {
          return;
        }

        currentRequest = null;
        const shouldRunTrailingRefresh =
          (outcome === "fulfilled" || outcome === "rejected") &&
          trailingRefreshPending &&
          mounted &&
          isVisible();

        trailingRefreshPending = false;

        if (shouldRunTrailingRefresh) {
          void startRequest("trailing");
        }
      }
    };

    const requestPromise = runRequest();
    currentRequest.promise = requestPromise;
    return requestPromise;
  };

  const requestRefresh = (reason) => {
    if (!mounted || !isVisible()) {
      return Promise.resolve("skipped");
    }

    if (currentRequest) {
      trailingRefreshPending = true;
      return currentRequest.promise;
    }

    return startRequest(reason);
  };

  const handleVisibilityChange = () => {
    const nextVisibilityState = getVisibilityState(documentObject);
    const becameVisible =
      mounted &&
      nextVisibilityState === "visible" &&
      lastVisibilityState !== "visible" &&
      documentObject?.hidden !== true;

    lastVisibilityState = nextVisibilityState;

    if (!becameVisible) {
      return;
    }

    resetTimer();
    void requestRefresh("visibility");
  };

  const start = () => {
    if (mounted) {
      return;
    }

    mounted = true;
    trailingRefreshPending = false;
    lastVisibilityState = getVisibilityState(documentObject);

    intervalId = setIntervalFn(handleTimer, refreshIntervalMs);
    documentObject?.addEventListener?.("visibilitychange", handleVisibilityChange);

    if (isVisible()) {
      void requestRefresh("mount");
    }
  };

  const stop = () => {
    mounted = false;
    trailingRefreshPending = false;

    if (intervalId !== null) {
      clearIntervalFn(intervalId);
      intervalId = null;
    }

    documentObject?.removeEventListener?.(
      "visibilitychange",
      handleVisibilityChange,
    );

    const request = currentRequest;
    currentRequest = null;

    if (request?.controller && !request.controller.signal.aborted) {
      request.controller.abort();
    }
  };

  return {
    start,
    stop,
    requestRefresh,
    getState: () => ({
      mounted,
      currentRequestId: currentRequest?.requestId || null,
      trailingRefreshPending,
      intervalActive: intervalId !== null,
      requestSequence,
    }),
  };
};
