import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSystemInformationViewModel,
  getApplicationVersion,
  getConnectionDisplay,
  getOfflineFeaturesDisplay,
  getServiceWorkerDisplay,
  SERVICE_WORKER_STATUSES,
  SYSTEM_CONNECTION_STATUSES,
} from "../src/pages/settings/systemInformationModel.js";

test("system information model exposes DISTYNC application metadata and configured version source", () => {
  const model = buildSystemInformationViewModel({
    roleCode: "BARANGAY",
    connectionStatus: SYSTEM_CONNECTION_STATUSES.ONLINE,
    serviceWorkerStatus: SERVICE_WORKER_STATUSES.ACTIVE,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastSuccessfulSyncAt: "2026-08-05T14:45:00.000Z",
    formatDateTime: (value) => `formatted:${value}`,
  });

  assert.equal(model.application.rows[0].value, "DISTYNC");
  assert.equal(model.application.rows[1].value, getApplicationVersion());
  assert.equal(model.application.rows[2].value, "Progressive Web Application");
  assert.notEqual(model.application.rows[1].value, "1.0.0");
});

test("connection display distinguishes online, offline, and limited connectivity", () => {
  assert.deepEqual(getConnectionDisplay(SYSTEM_CONNECTION_STATUSES.ONLINE), {
    label: "Online",
    tone: "success",
  });
  assert.deepEqual(getConnectionDisplay(SYSTEM_CONNECTION_STATUSES.OFFLINE), {
    label: "Offline",
    tone: "info",
  });
  assert.deepEqual(getConnectionDisplay(SYSTEM_CONNECTION_STATUSES.LIMITED), {
    label: "Limited connectivity",
    tone: "warning",
  });
});

test("service worker display covers active, waiting, failed, and unsupported states", () => {
  assert.deepEqual(getServiceWorkerDisplay(SERVICE_WORKER_STATUSES.ACTIVE), {
    label: "Active",
    tone: "success",
  });
  assert.deepEqual(getServiceWorkerDisplay(SERVICE_WORKER_STATUSES.WAITING), {
    label: "Waiting to activate",
    tone: "warning",
  });
  assert.deepEqual(
    getServiceWorkerDisplay(SERVICE_WORKER_STATUSES.REGISTRATION_FAILED),
    {
      label: "Registration failed",
      tone: "error",
    },
  );
  assert.deepEqual(getServiceWorkerDisplay(SERVICE_WORKER_STATUSES.UNSUPPORTED), {
    label: "Unsupported by this browser",
    tone: "info",
  });
});

test("offline features do not claim verification when service worker support is unavailable", () => {
  assert.deepEqual(
    getOfflineFeaturesDisplay({
      serviceWorkerStatus: SERVICE_WORKER_STATUSES.ACTIVE,
      roleCode: "BARANGAY",
    }),
    {
      value: "Supported features available",
      description:
        "Evacuee registration, departure updates, and relief claim confirmation",
      badge: { label: "Verified", tone: "success" },
    },
  );

  assert.deepEqual(
    getOfflineFeaturesDisplay({
      serviceWorkerStatus: SERVICE_WORKER_STATUSES.NOT_REGISTERED,
      roleCode: "MAYOR",
    }),
    {
      value: "Offline features currently unavailable",
      description:
        "Inventory inflow recording, donation encoding, and inventory item updates",
      badge: { label: "Unavailable", tone: "warning" },
    },
  );
});

test("system information model keeps unknown retrieval distinct from zero and no successful sync", () => {
  const model = buildSystemInformationViewModel({
    roleCode: "MSWDO",
    connectionStatus: SYSTEM_CONNECTION_STATUSES.LIMITED,
    serviceWorkerStatus: SERVICE_WORKER_STATUSES.REGISTRATION_FAILED,
    pendingCount: 0,
    failedCount: undefined,
    conflictCount: undefined,
    lastSuccessfulSyncAt: null,
    formatDateTime: (value) => value,
  });

  const offlineRows = Object.fromEntries(
    model.offline.rows.map((row) => [row.label, row.value]),
  );

  assert.equal(offlineRows["Pending Sync Records"], "0");
  assert.equal(offlineRows["Failed Sync Records"], "Unable to determine");
  assert.equal(offlineRows["Conflicts Requiring Review"], "Unable to determine");
  assert.equal(offlineRows["Last Successful Sync"], "Not yet synchronized");
});
