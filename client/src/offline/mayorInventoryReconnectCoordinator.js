import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "./syncService.js";
import {
  getRetryableSyncEntries,
  getSyncQueueActorContext,
} from "./syncQueue.js";
import { getMayorInventoryCacheScope } from "./mayorInventoryCache.js";
import { ROLE_CODES } from "../utils/roleSession.js";

const MAX_SCOPE_STATES = 16;

const readInitialOnlineState = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const normalizeScope = (scope = {}) => {
  const sourceScope = scope || {};
  const normalized = {
    accessMode: String(sourceScope.accessMode || "").trim(),
    userId: String(sourceScope.userId || "").trim(),
    roleCode: String(sourceScope.roleCode || "").trim(),
    deviceId: String(sourceScope.deviceId || "").trim() || null,
  };

  if (
    !normalized.accessMode ||
    !normalized.userId ||
    normalized.roleCode !== ROLE_CODES.MAYOR
  ) {
    return null;
  }

  return normalized;
};

export const buildMayorInventoryReconnectScopeKey = (scope) => {
  const normalized = normalizeScope(scope);

  if (!normalized) {
    return null;
  }

  return JSON.stringify([
    normalized.accessMode,
    normalized.userId,
    normalized.roleCode,
    normalized.deviceId || "browser",
  ]);
};

const createScopeState = (scope, scopeKey) => ({
  scope,
  scopeKey,
  lastTouched: 0,
  onlineEpisode: null,
  generation: 0,
  satisfiedGeneration: null,
  invalidationEpoch: 0,
  requiresPreparation: false,
  syncFinishedSequence: 0,
  inFlight: null,
});

const isSatisfied = (state, token = null) =>
  Boolean(
    state &&
      state.satisfiedGeneration !== null &&
      state.satisfiedGeneration === state.generation &&
      !state.requiresPreparation &&
      (!token ||
        (token.scopeKey === state.scopeKey &&
          token.generation === state.generation &&
          token.invalidationEpoch === state.invalidationEpoch)),
  );

const createSyncWaiter = (scopeKey, afterSequence) => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return {
    scopeKey,
    afterSequence,
    promise,
    resolve,
  };
};

export const createMayorInventoryReconnectCoordinator = ({
  getRetryableEntries = getRetryableSyncEntries,
  flushSync = flushPendingSyncEntries,
  initialOnline = readInitialOnlineState(),
} = {}) => {
  const scopeStates = new Map();
  const lifecycleListeners = new Set();
  const syncWaiters = new Set();
  let online = Boolean(initialOnline);
  let onlineEpisode = 0;
  let touchSequence = 0;

  const evictOldScopeStates = (preserveScopeKey = null) => {
    while (scopeStates.size > MAX_SCOPE_STATES) {
      const evictable = [...scopeStates.values()]
        .filter(
          (state) =>
            state.scopeKey !== preserveScopeKey &&
            !state.inFlight,
        )
        .sort((left, right) => left.lastTouched - right.lastTouched)[0];

      if (!evictable) {
        return;
      }

      scopeStates.delete(evictable.scopeKey);
    }
  };

  const getState = (scope, { create = true } = {}) => {
    const normalizedScope = normalizeScope(scope);
    const scopeKey = buildMayorInventoryReconnectScopeKey(normalizedScope);

    if (!scopeKey) {
      return null;
    }

    let state = scopeStates.get(scopeKey);
    if (!state && create) {
      state = createScopeState(normalizedScope, scopeKey);
      scopeStates.set(scopeKey, state);
    }

    if (!state) {
      return null;
    }

    state.lastTouched = ++touchSequence;
    evictOldScopeStates(scopeKey);
    return state;
  };

  const notify = (event) => {
    lifecycleListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (_error) {
        // Lifecycle observers must never block sync or preparation work.
      }
    });
  };

  const getSyncFinishedSequence = (scopeKey) =>
    scopeStates.get(scopeKey)?.syncFinishedSequence || 0;

  const resolveSyncWaiters = (scopeKey) => {
    const currentSequence = getSyncFinishedSequence(scopeKey);

    syncWaiters.forEach((waiter) => {
      if (
        waiter.scopeKey === scopeKey &&
        currentSequence > waiter.afterSequence
      ) {
        syncWaiters.delete(waiter);
        waiter.resolve(currentSequence);
      }
    });
  };

  const waitForSyncFinished = (scopeKey, afterSequence) => {
    const currentSequence = getSyncFinishedSequence(scopeKey);

    if (currentSequence > afterSequence) {
      return Promise.resolve(currentSequence);
    }

    const waiter = createSyncWaiter(scopeKey, afterSequence);
    syncWaiters.add(waiter);
    return waiter.promise;
  };

  const advanceGeneration = (state, reason) => {
    state.generation += 1;
    state.satisfiedGeneration = null;
    state.requiresPreparation = true;
    state.invalidationEpoch += 1;

    notify({
      type: "invalidated",
      reason,
      scope: state.scope,
      scopeKey: state.scopeKey,
      generation: state.generation,
      invalidationEpoch: state.invalidationEpoch,
    });

    return state;
  };

  const getToken = (state, { waitForSync = false } = {}) => {
    if (!state) {
      return null;
    }

    return {
      scope: state.scope,
      scopeKey: state.scopeKey,
      onlineEpisode: state.onlineEpisode,
      generation: state.generation,
      invalidationEpoch: state.invalidationEpoch,
      waitForSync,
    };
  };

  const handleOnline = () => {
    const wasOffline = !online;
    online = true;

    if (wasOffline) {
      onlineEpisode += 1;
    }

    const event = {
      type: "online",
      isNewReconnect: wasOffline,
      onlineEpisode,
    };
    notify(event);
    return event;
  };

  const handleOffline = () => {
    const wasOnline = online;
    online = false;

    const event = {
      type: "offline",
      isNewDisconnect: wasOnline,
    };
    notify(event);
    return event;
  };

  const beginReconnectGeneration = (scope) => {
    const state = getState(scope);

    if (!state) {
      return null;
    }

    if (state.onlineEpisode !== onlineEpisode) {
      state.onlineEpisode = onlineEpisode;
      state.generation += 1;
      state.satisfiedGeneration = null;
      state.requiresPreparation = true;
      state.invalidationEpoch += 1;
    }

    return getToken(state, { waitForSync: true });
  };

  const getCurrentGeneration = (scope, options) =>
    getToken(getState(scope), options);

  const invalidate = (scope, reason = "inventory-invalidated") => {
    const state = getState(scope);

    if (!state) {
      return null;
    }

    return getToken(advanceGeneration(state, reason));
  };

  const handleSyncFinished = (scope, event = {}) => {
    const scopeKey = buildMayorInventoryReconnectScopeKey(scope);

    if (scopeKey) {
      const state = getState(scope);
      state.syncFinishedSequence += 1;
      resolveSyncWaiters(scopeKey);
    }

    const token = invalidate(scope, "sync-finished");
    notify({
      type: "sync-finished",
      scope: normalizeScope(scope),
      scopeKey: token?.scopeKey || null,
      generation: token?.generation || null,
      outcome: event.outcome || null,
    });

    return token;
  };

  const markVerifiedCompleteGeneration = (scope, token = null) => {
    const state = getState(scope);

    if (!state) {
      return false;
    }

    const isCurrentToken =
      !token ||
      (token.scopeKey === state.scopeKey &&
        token.generation === state.generation &&
        token.invalidationEpoch === state.invalidationEpoch);

    if (!isCurrentToken) {
      return false;
    }

    state.satisfiedGeneration = state.generation;
    state.requiresPreparation = false;
    return true;
  };

  const requestCompleteGeneration = ({
    scope,
    token = null,
    force = false,
    requireFresh = false,
    waitForSync = false,
    run,
  } = {}) => {
    if (typeof run !== "function") {
      throw new TypeError(
        "requestCompleteGeneration requires a preparation function",
      );
    }

    const state = getState(scope);

    if (!state) {
      return Promise.resolve({
        status: "NOT_PREPARED",
        verifiedCompleteGraph: false,
      });
    }

    // Existing preparation jobs remain the single-flight boundary, including
    // when a lifecycle invalidation arrives while that job is in flight.
    // The stale result below causes the caller to request the new generation
    // after the old job has settled.
    if (state.inFlight) {
      return state.inFlight.promise;
    }

    if (state.generation === 0) {
      state.generation = 1;
      state.requiresPreparation = true;
    } else if (force) {
      advanceGeneration(state, "explicit-retry");
    } else if (
      requireFresh &&
      isSatisfied(state)
    ) {
      advanceGeneration(state, "cache-requires-refresh");
    }

    if (!force && !requireFresh && isSatisfied(state, token)) {
      return Promise.resolve({
        status: "READY",
        skipped: true,
        generation: state.generation,
        verifiedCompleteGraph: false,
      });
    }

    const promise = (async () => {
      const observedSyncFinishedSequence = getSyncFinishedSequence(
        state.scopeKey,
      );

      if (waitForSync) {
        let retryableEntries = [];

        try {
          retryableEntries = await getRetryableEntries();
        } catch (_error) {
          // A queue read failure must not prevent a normal online preparation
          // attempt. Sync retains ownership of queue error semantics.
          retryableEntries = [];
        }

        if (retryableEntries.length > 0) {
          let syncResult = null;

          try {
            syncResult = await flushSync({ source: "automatic" });
          } catch (_error) {
            // Continue with a server-authoritative graph where possible. The
            // sync service has already retained its own failure semantics.
          }

          if (
            syncResult?.outcome === "IN_FLIGHT" &&
            getSyncFinishedSequence(state.scopeKey) <=
              observedSyncFinishedSequence
          ) {
            await waitForSyncFinished(
              state.scopeKey,
              observedSyncFinishedSequence,
            );
          }
        }
      }

      const attemptGeneration = state.generation;
      const attemptInvalidationEpoch = state.invalidationEpoch;
      const result = await run();
      const verifiedCompleteGraph = result?.verifiedCompleteGraph === true;
      const isCurrentGeneration =
        state.generation === attemptGeneration &&
        state.invalidationEpoch === attemptInvalidationEpoch;

      if (
        verifiedCompleteGraph &&
        result?.status === "READY" &&
        isCurrentGeneration
      ) {
        markVerifiedCompleteGeneration(scope, {
          scopeKey: state.scopeKey,
          generation: attemptGeneration,
          invalidationEpoch: attemptInvalidationEpoch,
        });
      }

      return {
        ...result,
        generation: attemptGeneration,
        skipped: false,
        stale: !isCurrentGeneration,
        verifiedCompleteGraph,
      };
    })();

    state.inFlight = {
      generation: state.generation,
      promise,
    };

    const clearInFlight = () => {
      if (state.inFlight?.promise === promise) {
        state.inFlight = null;
      }
    };

    void promise.then(clearInFlight, clearInFlight);
    return promise;
  };

  const getStateSnapshot = (scope) => {
    const state = getState(scope, { create: false });

    if (!state) {
      return null;
    }

    return {
      scope: state.scope,
      scopeKey: state.scopeKey,
      onlineEpisode: state.onlineEpisode,
      generation: state.generation,
      satisfiedGeneration: state.satisfiedGeneration,
      invalidationEpoch: state.invalidationEpoch,
      requiresPreparation: state.requiresPreparation,
      inFlight: Boolean(state.inFlight),
    };
  };

  const hasPendingPreparation = (scope) => {
    const state = getState(scope, { create: false });
    return Boolean(state?.requiresPreparation);
  };

  const subscribe = (listener) => {
    if (typeof listener !== "function") {
      throw new TypeError("subscribe requires a lifecycle listener");
    }

    lifecycleListeners.add(listener);
    return () => lifecycleListeners.delete(listener);
  };

  return {
    beginReconnectGeneration,
    buildScopeKey: buildMayorInventoryReconnectScopeKey,
    getCurrentGeneration,
    getStateSnapshot,
    handleOffline,
    handleOnline,
    handleSyncFinished,
    hasPendingPreparation,
    invalidate,
    markVerifiedCompleteGeneration,
    requestCompleteGeneration,
    subscribe,
  };
};

const mayorInventoryReconnectCoordinator =
  createMayorInventoryReconnectCoordinator();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    mayorInventoryReconnectCoordinator.handleOnline();
  });
  window.addEventListener("offline", () => {
    mayorInventoryReconnectCoordinator.handleOffline();
  });

  subscribeToSyncUpdates((event = {}) => {
    if (event.type !== "finished") {
      return;
    }

    try {
      mayorInventoryReconnectCoordinator.handleSyncFinished(
        getMayorInventoryCacheScope(getSyncQueueActorContext()),
        event,
      );
    } catch (_error) {
      // Authentication may be changing while sync finishes. A later scoped
      // lifecycle event will establish the correct coordinator state.
    }
  });
}

export { mayorInventoryReconnectCoordinator };
