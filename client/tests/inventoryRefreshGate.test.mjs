import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryRefreshGate,
  shouldRefreshInventoryOnSyncEvent,
} from "../src/features/inventory/shared/inventoryRefreshGate.js";

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

test("sync started is ignored and sync finished is the one refresh event", () => {
  assert.equal(shouldRefreshInventoryOnSyncEvent({ type: "started" }), false);
  assert.equal(shouldRefreshInventoryOnSyncEvent({ type: "finished" }), true);
  assert.equal(shouldRefreshInventoryOnSyncEvent({ type: "queue-item-changed" }), false);
  assert.equal(shouldRefreshInventoryOnSyncEvent(), false);
});

test("passive refresh triggers share the active refresh without a trailing run", async () => {
  const gate = createInventoryRefreshGate();
  const active = createDeferred();
  let runCount = 0;

  const first = gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "initial",
    run: () => {
      runCount += 1;
      return active.promise;
    },
  });
  const timer = gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "timer",
    run: () => {
      runCount += 1;
      return Promise.resolve();
    },
  });
  const focus = gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "focus",
    run: () => {
      runCount += 1;
      return Promise.resolve();
    },
  });

  await flushMicrotasks();
  assert.equal(runCount, 1);
  active.resolve("current");
  assert.equal(await first, "current");
  assert.equal(await timer, "current");
  assert.equal(await focus, "current");
  assert.equal(runCount, 1);
});

test("a state-changing trigger during refresh schedules exactly one trailing refresh", async () => {
  const gate = createInventoryRefreshGate();
  const active = createDeferred();
  const trailing = createDeferred();
  let runCount = 0;

  const first = gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "initial",
    run: () => {
      runCount += 1;
      return active.promise;
    },
  });
  const mutationRefresh = gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "mutation",
    run: () => {
      runCount += 1;
      return trailing.promise;
    },
  });

  await flushMicrotasks();
  assert.equal(runCount, 1);
  active.resolve("stale");
  await flushMicrotasks();
  assert.equal(runCount, 2);
  trailing.resolve("fresh");
  assert.equal(await first, "stale");
  assert.equal(await mutationRefresh, "fresh");
});

test("many meaningful triggers collapse to one trailing refresh and stale work is not latest", async () => {
  const gate = createInventoryRefreshGate();
  const active = createDeferred();
  const trailing = createDeferred();
  let runCount = 0;
  let firstRequestIsLatest = null;

  gate.requestRefresh({
    scopeKey: "complete-inventory-graph",
    trigger: "initial",
    run: ({ isLatest }) => {
      runCount += 1;
      firstRequestIsLatest = isLatest;
      return active.promise;
    },
  });

  const trailingWaiters = Array.from({ length: 5 }, () =>
    gate.requestRefresh({
      scopeKey: "complete-inventory-graph",
      trigger: "sync-finished",
      run: () => {
        runCount += 1;
        return trailing.promise;
      },
    }),
  );

  await flushMicrotasks();
  assert.equal(runCount, 1);
  assert.equal(firstRequestIsLatest(), false);
  active.resolve("old");
  await flushMicrotasks();
  assert.equal(runCount, 2);
  trailing.resolve("new");
  assert.deepEqual(await Promise.all(trailingWaiters), [
    "new",
    "new",
    "new",
    "new",
    "new",
  ]);
});
