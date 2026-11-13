import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildInventoryDistributionReadinessScopeKey,
  createInventoryDistributionReadinessRequestGuard,
} from "../src/features/inventory-distribution/inventoryDistributionReadiness.js";

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

const activeRow = { stub_id: "stub-a", household_id: "household-a" };

test("readiness scope does not start for report browsing or ended details", () => {
  assert.equal(
    buildInventoryDistributionReadinessScopeKey({
      isOpen: false,
      showReadinessStatus: true,
      row: activeRow,
      disasterEventId: "event-a",
    }),
    "",
  );
  assert.equal(
    buildInventoryDistributionReadinessScopeKey({
      isOpen: true,
      showReadinessStatus: false,
      row: activeRow,
      disasterEventId: "event-a",
    }),
    "",
  );
  assert.equal(
    buildInventoryDistributionReadinessScopeKey({
      isOpen: true,
      showReadinessStatus: true,
      row: activeRow,
      disasterEventId: "event-a",
    }),
    "0|event-a|stub-a",
  );
});
test("readiness scope changes for event, row, and modal sessions", () => {
  const eventAScope = buildInventoryDistributionReadinessScopeKey({
    isOpen: true,
    showReadinessStatus: true,
    row: activeRow,
    disasterEventId: "event-a",
    requestSequence: 1,
  });
  const eventBScope = buildInventoryDistributionReadinessScopeKey({
    isOpen: true,
    showReadinessStatus: true,
    row: activeRow,
    disasterEventId: "event-b",
    requestSequence: 1,
  });
  const rowBScope = buildInventoryDistributionReadinessScopeKey({
    isOpen: true,
    showReadinessStatus: true,
    row: { stub_id: "stub-b" },
    disasterEventId: "event-a",
    requestSequence: 1,
  });
  const reopenedScope = buildInventoryDistributionReadinessScopeKey({
    isOpen: true,
    showReadinessStatus: true,
    row: activeRow,
    disasterEventId: "event-a",
    requestSequence: 2,
  });

  assert.notEqual(eventAScope, eventBScope);
  assert.notEqual(eventAScope, rowBScope);
  assert.notEqual(eventAScope, reopenedScope);
});

test("stale event, row, and closed-modal readiness generations are ignored", () => {
  const guard = createInventoryDistributionReadinessRequestGuard();

  const eventARequest = guard.start();
  const rowBRequest = guard.start();
  assert.equal(guard.isCurrent(eventARequest), false);
  assert.equal(guard.isCurrent(rowBRequest), true);

  const eventBRequest = guard.start();
  guard.invalidate();
  assert.equal(guard.isCurrent(eventBRequest), false);

  const reopenedRequest = guard.start();
  guard.invalidate();
  assert.equal(guard.isCurrent(reopenedRequest), false);
});

test("Inventory Distribution removes passive batch loading and fetches only modal readiness", async () => {
  const [distributionHook, readinessHook, pageSource, modalSource] =
    await Promise.all([
      readSource("../src/features/inventory-distribution/useInventoryDistribution.js"),
      readSource(
        "../src/features/inventory-distribution/useInventoryDistributionReadiness.js",
      ),
      readSource("../src/pages/inventory/InventoryDistributionPage.jsx"),
      readSource(
        "../src/components/inventory-distribution/InventoryDistributionDetailModal.jsx",
      ),
    ]);

  assert.doesNotMatch(distributionHook, /fetchInventoryBatches/);
  assert.doesNotMatch(distributionHook, /setInterval\(/);
  assert.doesNotMatch(distributionHook, /addEventListener\("focus"/);
  assert.doesNotMatch(distributionHook, /visibilitychange/);

  assert.match(readinessHook, /fetchInventoryBatches\(\)/);
  assert.doesNotMatch(readinessHook, /fetchInventoryBatches\(\{/);
  assert.match(readinessHook, /createInventoryDistributionReadinessRequestGuard/);
  assert.match(readinessHook, /requestGuard\.isCurrent\(requestGeneration\)/);

  assert.match(pageSource, /useInventoryDistributionReadiness/);
  assert.match(pageSource, /showReadinessStatus = selectedDisasterEvent\?\.status === "ACTIVE"/);
  assert.match(pageSource, /isOpen: isDistributionDetailOpen/);
  assert.match(pageSource, /inventoryBatches=\{readinessInventoryBatches\}/);
  assert.match(pageSource, /isReadinessLoading=\{isReadinessLoading\}/);
  assert.match(pageSource, /readinessErrorMessage=\{readinessErrorMessage\}/);

  assert.match(modalSource, /isReadinessLoading = false/);
  assert.match(modalSource, /readinessErrorMessage = ""/);
  assert.match(
    modalSource,
    /showReadinessStatus && !isReadinessLoading && !readinessErrorMessage/,
  );
  assert.match(modalSource, /Loading inventory readiness\.\.\./);
  assert.match(modalSource, /Readiness is unavailable:/);
});
