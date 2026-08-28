import assert from "node:assert/strict";
import test from "node:test";

import {
  getLatestHouseholdLifecycleEntry,
  resolveEffectiveMasterlistRows,
} from "../src/features/masterlist/barangayMasterlistUi.js";

const activeRow = (id) => ({
  household_id: id,
  masterlist_record_id: id,
  family_head_name: id,
  is_active: true,
  is_operationally_active: true,
  can_record_departure: true,
});

const entry = ({ id, actionKey, status = "PENDING", timestamp }) => ({
  id: `${actionKey}-${id}`,
  actionKey,
  entityType: "HOUSEHOLD",
  entityServerId: id,
  entityLocalId: id,
  status,
  clientTimestamp: timestamp,
  payload: {
    disaster_event_id: "event-a",
    barangay_id: "barangay-a",
    family_head: { first_name: id, last_name: "Family" },
    members: [],
  },
});

test("registration remains Active for every synchronization state", () => {
  for (const status of ["PENDING", "FAILED", "CONFLICT", "SYNCED"]) {
    const rows = resolveEffectiveMasterlistRows({
      rows: [],
      recordStatus: "active",
      selectedEventId: "event-a",
      assignedBarangayId: "barangay-a",
      syncQueueEntries: [
        entry({ id: "local-1", actionKey: "HOUSEHOLD_REGISTER", status, timestamp: "2026-01-01" }),
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_active, true);
    assert.equal(rows[0].sync_status, status);
  }

  const archivedRows = resolveEffectiveMasterlistRows({
    rows: [],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [entry({ id: "local-1", actionKey: "HOUSEHOLD_REGISTER", timestamp: "2026-01-01" })],
  });
  assert.equal(archivedRows.length, 0);
});

test("pending departure overlays the server Active occurrence into Archived exactly once", () => {
  const departure = entry({
    id: "household-1",
    actionKey: "HOUSEHOLD_DEPART",
    timestamp: "2026-01-02",
  });
  const rows = resolveEffectiveMasterlistRows({
    rows: [activeRow("household-1")],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].household_id, "household-1");
  assert.equal(rows[0].is_operationally_active, false);
  assert.equal(rows[0].sync_status, "PENDING");

  const activeRows = resolveEffectiveMasterlistRows({
    rows: [activeRow("household-1")],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure],
  });
  assert.equal(activeRows.length, 0);
});

test("latest lifecycle action wins without name-based deduplication", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [activeRow("household-1")],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [
      entry({ id: "household-1", actionKey: "HOUSEHOLD_DEPART", timestamp: "2026-01-02" }),
      entry({ id: "household-1", actionKey: "HOUSEHOLD_UPDATE", timestamp: "2026-01-03", status: "FAILED" }),
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].is_operationally_active, true);
  assert.equal(
    getLatestHouseholdLifecycleEntry(
      [
        entry({ id: "household-1", actionKey: "HOUSEHOLD_DEPART", timestamp: "2026-01-02" }),
        entry({ id: "household-1", actionKey: "HOUSEHOLD_UPDATE", timestamp: "2026-01-03" }),
      ],
      activeRow("household-1"),
    ).actionKey,
    "HOUSEHOLD_UPDATE",
  );
});

test("archived historical and re-admitted active occurrences remain distinct", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [
      { ...activeRow("historical-1"), is_active: false, is_operationally_active: false },
    ],
    recordStatus: "all",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [
      entry({ id: "new-2", actionKey: "HOUSEHOLD_RE_ADMISSION", timestamp: "2026-01-03" }),
    ],
  });

  assert.deepEqual(
    rows.map((row) => row.household_id).sort(),
    ["historical-1", "new-2"],
  );
});
