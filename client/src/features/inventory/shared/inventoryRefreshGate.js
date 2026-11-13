const PASSIVE_REFRESH_TRIGGERS = new Set([
  "initial",
  "timer",
  "focus",
  "visibility",
]);

export const shouldRefreshInventoryOnSyncEvent = (event = {}) =>
  event?.type === "finished";

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

export const createInventoryRefreshGate = () => {
  let activeRequest = null;
  let trailingRequest = null;
  let generationSequence = 0;
  let latestGeneration = 0;

  const settleTrailingWaiters = (waiters, method, value) => {
    waiters.forEach((waiter) => waiter[method](value));
  };

  const finishRequest = (requestPromise) => {
    if (activeRequest?.promise !== requestPromise) {
      return;
    }

    activeRequest = null;

    if (!trailingRequest) {
      return;
    }

    const nextRequest = trailingRequest;
    trailingRequest = null;
    const nextPromise = startRequest(nextRequest);

    void nextPromise.then(
      (nextValue) =>
        settleTrailingWaiters(nextRequest.waiters, "resolve", nextValue),
      (nextError) =>
        settleTrailingWaiters(nextRequest.waiters, "reject", nextError),
    );
  };

  const startRequest = ({ scopeKey, run, generation }) => {
    const requestPromise = Promise.resolve().then(() =>
      run({
        generation,
        isLatest: () => generation === latestGeneration,
      }),
    );

    activeRequest = {
      promise: requestPromise,
      scopeKey,
      generation,
    };

    void requestPromise.then(
      () => finishRequest(requestPromise),
      () => finishRequest(requestPromise),
    );

    return requestPromise;
  };

  const requestRefresh = ({
    scopeKey = "default",
    trigger = "passive",
    run,
  } = {}) => {
    if (typeof run !== "function") {
      throw new TypeError("createInventoryRefreshGate requires a run function");
    }

    const normalizedScopeKey = String(scopeKey);

    if (!activeRequest) {
      const generation = ++generationSequence;
      latestGeneration = generation;
      return startRequest({
        scopeKey: normalizedScopeKey,
        run,
        generation,
      });
    }

    const scopeChanged = activeRequest.scopeKey !== normalizedScopeKey;
    const requiresTrailingRefresh =
      scopeChanged || !PASSIVE_REFRESH_TRIGGERS.has(trigger);

    if (!requiresTrailingRefresh) {
      return activeRequest.promise;
    }

    const generation = ++generationSequence;
    latestGeneration = generation;
    const waiter = createDeferred();

    if (trailingRequest) {
      trailingRequest.scopeKey = normalizedScopeKey;
      trailingRequest.run = run;
      trailingRequest.generation = generation;
      trailingRequest.waiters.push(waiter);
    } else {
      trailingRequest = {
        scopeKey: normalizedScopeKey,
        run,
        generation,
        waiters: [waiter],
      };
    }

    return waiter.promise;
  };

  return {
    requestRefresh,
  };
};
