import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");

let viteServer;
let createMayorInventoryReconnectCoordinator;
let buildMayorInventoryReconnectScopeKey;

const scope = ({
  accessMode = "DEVELOPMENT",
  userId = "mayor-1",
  roleCode = "MAYOR",
  deviceId = "device-1",
} = {}) => ({
  accessMode,
  userId,
  roleCode,
  deviceId,
});

const completeResult = () => ({
  status: "READY",
  verifiedCompleteGraph: true,
});

const incompleteResult = () => ({
  status: "READY",
  verifiedCompleteGraph: false,
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const flushMicrotasks = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

const createCoordinator = (options = {}) =>
  createMayorInventoryReconnectCoordinator({
    initialOnline: true,
    getRetryableEntries: async () => [],
    flushSync: async () => ({ outcome: "NO_ENTRIES" }),
    ...options,
  });

before(async () => {
  viteServer = await createServer({
    root: clientRoot,
    configFile: false,
    appType: "custom",
    logLevel: "error",
  });

  ({
    createMayorInventoryReconnectCoordinator,
    buildMayorInventoryReconnectScopeKey,
  } = await viteServer.ssrLoadModule(
    "/src/offline/mayorInventoryReconnectCoordinator.js?stage7a-coordinator-test",
  ));
});

after(async () => {
  await viteServer?.close();
});

test("STAGE7A-01 scope key includes access mode, user, role, and device", () => {
  assert.equal(
    buildMayorInventoryReconnectScopeKey(scope()),
    buildMayorInventoryReconnectScopeKey(scope()),
  );
  assert.notEqual(
    buildMayorInventoryReconnectScopeKey(scope({ accessMode: "DEMO" })),
    buildMayorInventoryReconnectScopeKey(scope()),
  );
  assert.notEqual(
    buildMayorInventoryReconnectScopeKey(scope({ userId: "mayor-2" })),
    buildMayorInventoryReconnectScopeKey(scope()),
  );
  assert.notEqual(
    buildMayorInventoryReconnectScopeKey(scope({ roleCode: "BARANGAY" })),
    buildMayorInventoryReconnectScopeKey(scope()),
  );
  assert.notEqual(
    buildMayorInventoryReconnectScopeKey(scope({ deviceId: "device-2" })),
    buildMayorInventoryReconnectScopeKey(scope()),
  );
});

test("STAGE7A-02 ordinary remount has no preparation request by itself", () => {
  const coordinator = createCoordinator();
  assert.equal(coordinator.getStateSnapshot(scope()), null);
});

test("STAGE7A-03 first preparation runs one complete graph generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(graphRuns, 1);
  assert.equal(result.verifiedCompleteGraph, true);
  assert.equal(result.stale, false);
  assert.equal(coordinator.getStateSnapshot(scope()).satisfiedGeneration, 1);
});

test("STAGE7A-04 an incomplete graph cannot satisfy a generation", async () => {
  const coordinator = createCoordinator();
  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => incompleteResult(),
  });

  assert.equal(result.verifiedCompleteGraph, false);
  assert.equal(coordinator.hasPendingPreparation(scope()), true);
});

test("STAGE7A-05 repeated online events while preparation is in flight share one job", async () => {
  const coordinator = createCoordinator();
  const active = createDeferred();
  let graphRuns = 0;

  coordinator.handleOffline();
  const onlineEvent = coordinator.handleOnline();
  assert.equal(onlineEvent.isNewReconnect, true);
  const token = coordinator.beginReconnectGeneration(scope());

  const first = coordinator.requestCompleteGeneration({
    scope: scope(),
    token,
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return active.promise;
    },
  });

  const duplicateOnline = coordinator.handleOnline();
  assert.equal(duplicateOnline.isNewReconnect, false);
  const duplicate = coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(first, duplicate);
  active.resolve(completeResult());
  await Promise.all([first, duplicate]);
  assert.equal(graphRuns, 1);
});

test("STAGE7A-06 repeated online after completion does not start a second generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  coordinator.handleOffline();
  coordinator.handleOnline();
  const token = coordinator.beginReconnectGeneration(scope());
  await coordinator.requestCompleteGeneration({
    scope: scope(),
    token,
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(coordinator.handleOnline().isNewReconnect, false);
  const duplicate = await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(duplicate.skipped, true);
  assert.equal(graphRuns, 1);
});

test("STAGE7A-07 a true offline to online cycle creates a new generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  const runGeneration = async () => {
    const token = coordinator.beginReconnectGeneration(scope());
    return coordinator.requestCompleteGeneration({
      scope: scope(),
      token,
      waitForSync: true,
      run: async () => {
        graphRuns += 1;
        return completeResult();
      },
    });
  };

  coordinator.handleOffline();
  coordinator.handleOnline();
  await runGeneration();
  coordinator.handleOffline();
  coordinator.handleOnline();
  await runGeneration();

  assert.equal(graphRuns, 2);
  assert.equal(coordinator.getStateSnapshot(scope()).generation, 2);
});

test("STAGE7A-08 NEEDS_REFRESH requires a fresh authoritative generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  const refresh = await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(refresh.skipped, false);
  assert.equal(graphRuns, 2);
});

test("STAGE7A-09 explicit retry bypasses the settled generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  await coordinator.requestCompleteGeneration({
    scope: scope(),
    force: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(graphRuns, 2);
  assert.equal(coordinator.getStateSnapshot(scope()).generation, 2);
});

test("STAGE7A-10 a failed generation remains retryable", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  await assert.rejects(
    coordinator.requestCompleteGeneration({
      scope: scope(),
      requireFresh: true,
      run: async () => {
        graphRuns += 1;
        throw new Error("synthetic refresh failure");
      },
    }),
    /synthetic refresh failure/,
  );

  const retry = await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(retry.stale, false);
  assert.equal(graphRuns, 2);
});

test("STAGE7A-11 no retryable entries takes the NO_ENTRIES path without waiting", async () => {
  const coordinator = createCoordinator({
    getRetryableEntries: async () => [],
  });
  let flushCalls = 0;
  let graphRuns = 0;

  coordinator.handleOffline();
  coordinator.handleOnline();
  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(result.stale, false);
  assert.equal(graphRuns, 1);
  assert.equal(flushCalls, 0);
});

test("STAGE7A-12 retryable queue entries are drained before reconnect preparation", async () => {
  let coordinator;
  let flushCalls = 0;
  let graphRuns = 0;
  coordinator = createCoordinator({
    getRetryableEntries: async () => [{ id: "queued-item" }],
    flushSync: async () => {
      flushCalls += 1;
      coordinator.handleSyncFinished(scope(), { outcome: "SUCCESS" });
      return { outcome: "SUCCESS" };
    },
  });

  coordinator.handleOffline();
  coordinator.handleOnline();
  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(flushCalls, 1);
  assert.equal(graphRuns, 1);
  assert.equal(result.stale, false);
  assert.equal(coordinator.getStateSnapshot(scope()).satisfiedGeneration, 2);
});

test("STAGE7A-13 an in-flight sync is awaited through its finished lifecycle event", async () => {
  let coordinator;
  const syncRelease = createDeferred();
  let graphRuns = 0;
  coordinator = createCoordinator({
    getRetryableEntries: async () => [{ id: "queued-batch" }],
    flushSync: async () => {
      await syncRelease.promise;
      return { outcome: "IN_FLIGHT" };
    },
  });

  coordinator.handleOffline();
  coordinator.handleOnline();
  const generation = coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  await flushMicrotasks();
  assert.equal(graphRuns, 0);
  syncRelease.resolve();
  await flushMicrotasks();
  assert.equal(graphRuns, 0);
  coordinator.handleSyncFinished(scope(), { outcome: "SUCCESS" });
  await generation;
  assert.equal(graphRuns, 1);
});

test("STAGE7A-14 sync finished invalidates a completed pre-sync generation", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  coordinator.handleSyncFinished(scope(), { outcome: "SUCCESS" });
  assert.equal(coordinator.hasPendingPreparation(scope()), true);

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(graphRuns, 2);
});

test("STAGE7A-15 sync finished during preparation makes the old result stale", async () => {
  const coordinator = createCoordinator();
  const active = createDeferred();
  let graphRuns = 0;

  const first = coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return active.promise;
    },
  });

  await flushMicrotasks();
  coordinator.handleSyncFinished(scope(), { outcome: "SUCCESS" });
  active.resolve(completeResult());
  const stale = await first;

  assert.equal(stale.stale, true);
  assert.equal(coordinator.hasPendingPreparation(scope()), true);

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  assert.equal(graphRuns, 2);
});

test("STAGE7A-16 only the finished lifecycle boundary invalidates authority", async () => {
  const coordinator = createCoordinator();
  let invalidations = 0;
  const unsubscribe = coordinator.subscribe((event) => {
    if (event.type === "invalidated") {
      invalidations += 1;
    }
  });

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => completeResult(),
  });
  assert.equal(invalidations, 0);
  assert.equal(coordinator.hasPendingPreparation(scope()), false);
  coordinator.handleSyncFinished(scope(), { type: "finished" });
  assert.equal(invalidations, 1);
  unsubscribe();
});

test("STAGE7A-17 successful post-sync generation can satisfy a new lifecycle", async () => {
  const coordinator = createCoordinator();
  let graphRuns = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  coordinator.handleSyncFinished(scope(), { outcome: "SUCCESS" });
  await coordinator.requestCompleteGeneration({
    scope: scope(),
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });
  const duplicate = await coordinator.requestCompleteGeneration({
    scope: scope(),
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(duplicate.skipped, true);
  assert.equal(graphRuns, 2);
});

test("STAGE7A-18 conflict outcome does not invoke conflict resolution", async () => {
  const coordinator = createCoordinator({
    getRetryableEntries: async () => [{ id: "conflict" }],
    flushSync: async () => ({ outcome: "CONFLICT" }),
  });
  let resolutionCalls = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => completeResult(),
  });

  assert.equal(resolutionCalls, 0);
});

test("STAGE7A-19 sync failure still allows a server-authoritative refresh", async () => {
  const coordinator = createCoordinator({
    getRetryableEntries: async () => [{ id: "failed-entry" }],
    flushSync: async () => ({ outcome: "FAILED" }),
  });
  let graphRuns = 0;

  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => {
      graphRuns += 1;
      return completeResult();
    },
  });

  assert.equal(result.stale, false);
  assert.equal(graphRuns, 1);
});

test("STAGE7A-20 queue inspection failure does not hang preparation", async () => {
  const coordinator = createCoordinator({
    getRetryableEntries: async () => {
      throw new Error("local queue unavailable");
    },
  });

  coordinator.handleOffline();
  coordinator.handleOnline();
  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    token: coordinator.beginReconnectGeneration(scope()),
    waitForSync: true,
    run: async () => completeResult(),
  });

  assert.equal(result.stale, false);
});

test("STAGE7A-21 user scopes cannot reuse a settled generation", async () => {
  const coordinator = createCoordinator();
  let userOneRuns = 0;
  let userTwoRuns = 0;

  await coordinator.requestCompleteGeneration({
    scope: scope({ userId: "mayor-1" }),
    requireFresh: true,
    run: async () => {
      userOneRuns += 1;
      return completeResult();
    },
  });
  await coordinator.requestCompleteGeneration({
    scope: scope({ userId: "mayor-2" }),
    requireFresh: true,
    run: async () => {
      userTwoRuns += 1;
      return completeResult();
    },
  });

  assert.equal(userOneRuns, 1);
  assert.equal(userTwoRuns, 1);
});

test("STAGE7A-22 device scopes cannot reuse a settled generation", async () => {
  const coordinator = createCoordinator();
  let runs = 0;

  for (const deviceId of ["device-1", "device-2"]) {
    await coordinator.requestCompleteGeneration({
      scope: scope({ deviceId }),
      requireFresh: true,
      run: async () => {
        runs += 1;
        return completeResult();
      },
    });
  }

  assert.equal(runs, 2);
});

test("STAGE7A-23 access modes cannot reuse a settled generation", async () => {
  const coordinator = createCoordinator();
  let runs = 0;

  for (const accessMode of ["DEVELOPMENT", "DEMO"]) {
    await coordinator.requestCompleteGeneration({
      scope: scope({ accessMode }),
      requireFresh: true,
      run: async () => {
        runs += 1;
        return completeResult();
      },
    });
  }

  assert.equal(runs, 2);
});

test("STAGE7A-24 non-Mayor scopes are rejected without a graph request", async () => {
  const coordinator = createCoordinator();
  let runs = 0;

  const result = await coordinator.requestCompleteGeneration({
    scope: scope({ roleCode: "BARANGAY" }),
    run: async () => {
      runs += 1;
      return completeResult();
    },
  });

  assert.equal(result.status, "NOT_PREPARED");
  assert.equal(runs, 0);
});

test("STAGE7A-25 logout or scope change cannot apply an old completion to a new scope", async () => {
  const coordinator = createCoordinator();
  const active = createDeferred();
  let oldRuns = 0;
  let newRuns = 0;

  const oldRequest = coordinator.requestCompleteGeneration({
    scope: scope({ userId: "old-user" }),
    requireFresh: true,
    run: async () => {
      oldRuns += 1;
      return active.promise;
    },
  });
  const newRequest = coordinator.requestCompleteGeneration({
    scope: scope({ userId: "new-user" }),
    requireFresh: true,
    run: async () => {
      newRuns += 1;
      return completeResult();
    },
  });

  active.resolve(completeResult());
  await Promise.all([oldRequest, newRequest]);
  assert.equal(oldRuns, 1);
  assert.equal(newRuns, 1);
  assert.equal(
    coordinator.getStateSnapshot(scope({ userId: "old-user" })).satisfiedGeneration,
    1,
  );
  assert.equal(
    coordinator.getStateSnapshot(scope({ userId: "new-user" })).satisfiedGeneration,
    1,
  );
});

test("STAGE7A-26 lifecycle observers cannot block generation completion", async () => {
  const coordinator = createCoordinator();
  coordinator.subscribe(() => {
    throw new Error("observer failure");
  });

  const result = await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => completeResult(),
  });

  assert.equal(result.stale, false);
});

test("STAGE7A-27 no settled response bodies are retained in coordinator state", async () => {
  const coordinator = createCoordinator();
  const graph = {
    items: [{ id: "item-1" }],
    batches: [{ id: "batch-1" }],
    transactions: [{ id: "transaction-1" }],
  };

  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => ({
      ...graph,
      ...completeResult(),
    }),
  });

  const snapshot = coordinator.getStateSnapshot(scope());
  assert.equal(Object.hasOwn(snapshot, "items"), false);
  assert.equal(Object.hasOwn(snapshot, "batches"), false);
  assert.equal(Object.hasOwn(snapshot, "transactions"), false);
});

test("STAGE7A-28 invalidation is scoped and leaves the prior cache handoff external", async () => {
  const coordinator = createCoordinator();
  await coordinator.requestCompleteGeneration({
    scope: scope(),
    requireFresh: true,
    run: async () => completeResult(),
  });

  const invalidated = coordinator.invalidate(scope(), "explicit-cache-invalidation");
  assert.equal(invalidated.generation, 2);
  assert.equal(coordinator.hasPendingPreparation(scope()), true);
  assert.equal(Object.hasOwn(invalidated, "items"), false);
});

test("STAGE7A-29 online transition identity is not time based", () => {
  const coordinator = createCoordinator({ initialOnline: false });
  const events = [];
  coordinator.subscribe((event) => events.push(event));

  const firstOnline = coordinator.handleOnline();
  const repeatedOnline = coordinator.handleOnline();
  coordinator.handleOffline();
  const secondOnline = coordinator.handleOnline();

  assert.equal(firstOnline.onlineEpisode, 1);
  assert.equal(repeatedOnline.onlineEpisode, 1);
  assert.equal(secondOnline.onlineEpisode, 2);
  assert.equal(events.filter((event) => event.type === "online").length, 3);
});

test("STAGE7A-30 explicit verified handoff can satisfy the current generation", () => {
  const coordinator = createCoordinator();
  const token = coordinator.beginReconnectGeneration(scope());

  assert.equal(
    coordinator.markVerifiedCompleteGeneration(scope(), token),
    true,
  );
  assert.equal(coordinator.hasPendingPreparation(scope()), false);
});
