import assert from "node:assert/strict";
import test from "node:test";

import {
  getLatestHouseholdLifecycleEntry,
  resolveDepartureSyncStatus,
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

    assert.equal(rows.length, status === "CONFLICT" ? 0 : 1);
    if (status !== "CONFLICT") {
      assert.equal(rows[0].is_active, true);
      assert.equal(rows[0].sync_status, status);
    }
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

test("conflicted offline registration is removed from the normal Masterlist but remains queue-addressable", () => {
  const authoritativeRow = {
    ...activeRow("authoritative-household"),
    family_head_name: "Ellen Adarna",
  };
  const conflictedEntry = entry({
    id: "local-duplicate-operation",
    actionKey: "HOUSEHOLD_REGISTER",
    status: "CONFLICT",
    timestamp: "2026-01-02T10:00:00.000Z",
  });
  conflictedEntry.entityLocalId = "local-duplicate-household";
  conflictedEntry.entityServerId = null;

  const rows = resolveEffectiveMasterlistRows({
    rows: [authoritativeRow],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [conflictedEntry],
  });

  assert.deepEqual(rows.map((row) => row.household_id), ["authoritative-household"]);
  assert.equal(rows[0].family_head_name, "Ellen Adarna");
  assert.equal(conflictedEntry.status, "CONFLICT");
  assert.equal(conflictedEntry.id, "HOUSEHOLD_REGISTER-local-duplicate-operation");
});

test("failed registration remains projected for existing retry behavior", () => {
  const failed = entry({
    id: "local-failed-operation",
    actionKey: "HOUSEHOLD_REGISTER",
    status: "FAILED",
    timestamp: "2026-01-02T10:00:00.000Z",
  });

  const rows = resolveEffectiveMasterlistRows({
    rows: [],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [failed],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].household_id, failed.entityLocalId);
  assert.equal(rows[0].sync_status, "FAILED");
});

test("pending departure overlays the server Active occurrence into Archived exactly once", () => {
  const departure = entry({
    id: "household-1",
    actionKey: "HOUSEHOLD_DEPART",
    timestamp: "2026-01-02",
  });
  const rows = resolveEffectiveMasterlistRows({
    rows: [{
      ...activeRow("household-1"),
      family_head_name: "Alyanna Perez",
      members_count: 2,
      sectors_text: "Teenage, Adult",
      arrival_time_text: "Sep 7, 2026, 9:45 AM",
      offline_household_details: { members: [{ id: "head" }, { id: "member" }] },
    }],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].household_id, "household-1");
  assert.equal(rows[0].is_operationally_active, false);
  assert.equal(rows[0].sync_status, "PENDING");
  assert.equal(rows[0].family_head_name, "Alyanna Perez");
  assert.equal(rows[0].members_count, 2);
  assert.equal(rows[0].sectors_text, "Teenage, Adult");
  assert.equal(rows[0].arrival_time_text, "Sep 7, 2026, 9:45 AM");
  assert.equal(rows[0].departure_time_value, "2026-01-02");
  assert.deepEqual(rows[0].offline_household_details.members, [{ id: "head" }, { id: "member" }]);
  assert.equal(rows[0].departure_sync_status, "PENDING");
  assert.equal(rows[0].departure_sync_tooltip, "Departure pending synchronization");

  const activeRows = resolveEffectiveMasterlistRows({
    rows: [activeRow("household-1")],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure],
  });
  assert.equal(activeRows.length, 0);
});

test("conflicted departure does not synthesize a placeholder and preserves the authoritative archived row", () => {
  const conflictedDeparture = entry({
    id: "household-1",
    actionKey: "HOUSEHOLD_DEPART",
    status: "CONFLICT",
    timestamp: "2026-01-02T10:00:00.000Z",
  });
  const authoritativeRow = {
    ...activeRow("household-1"),
    family_head_name: "Ellen Adarna",
    is_active: false,
    is_operationally_active: false,
    members_count: 1,
    sectors_text: "Adult",
    arrival_time_text: "Jan 2, 2026, 9:45 AM",
    departure_time_value: "2026-01-02T09:53:00.000Z",
    departure_time_text: "Jan 2, 2026, 9:53 AM",
  };

  const rows = resolveEffectiveMasterlistRows({
    rows: [authoritativeRow],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [conflictedDeparture],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].household_id, "household-1");
  assert.equal(rows[0].family_head_name, "Ellen Adarna");
  assert.equal(rows[0].departure_time_value, "2026-01-02T09:53:00.000Z");

  const withoutAuthoritativeRow = resolveEffectiveMasterlistRows({
    rows: [],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [conflictedDeparture],
  });

  assert.equal(withoutAuthoritativeRow.length, 0);
  assert.equal(conflictedDeparture.status, "CONFLICT");
});

test("departure status maps persisted queue states to the three departure icons", () => {
  for (const [status, displayStatus, tooltip] of [
    ["PENDING", "PENDING", "Departure pending synchronization"],
    ["SYNCED", "SYNCED", "Departure synchronized"],
    ["FAILED", "FAILED", "Departure synchronization failed"],
    ["CONFLICT", "FAILED", "Departure synchronization conflict"],
  ]) {
    const result = resolveDepartureSyncStatus({
      row: { household_id: "household-1", masterlist_record_id: "household-1" },
      syncQueueEntries: [
        entry({ id: "household-1", actionKey: "HOUSEHOLD_DEPART", status, timestamp: "2026-01-02" }),
      ],
    });

    assert.equal(result.status, displayStatus);
    assert.equal(result.detailedStatus, status);
    assert.equal(result.tooltip, tooltip);
  }
});

test("archived departure status binds by household and respects queue Barangay scope", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [
      { ...activeRow("household-a"), is_active: false, is_operationally_active: false },
      { ...activeRow("household-b"), is_active: false, is_operationally_active: false },
    ],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [
      {
        ...entry({ id: "household-a", actionKey: "HOUSEHOLD_DEPART", status: "PENDING", timestamp: "2026-01-02" }),
        barangayId: "barangay-a",
      },
      {
        ...entry({ id: "household-b", actionKey: "HOUSEHOLD_DEPART", status: "FAILED", timestamp: "2026-01-02" }),
        barangayId: "barangay-b",
      },
    ],
  });

  assert.equal(rows.find((row) => row.household_id === "household-a").departure_sync_status, "PENDING");
  assert.equal(rows.find((row) => row.household_id === "household-b").departure_sync_status, "SYNCED");
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

test("pending registrations are sorted with synced rows newest-first", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [
      { ...activeRow("synced"), registered_at: "2026-01-01T15:02:00Z" },
    ],
    recordStatus: "active",
    sortOrder: "newest",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [
      entry({ id: "local-a", actionKey: "HOUSEHOLD_REGISTER", timestamp: "2026-01-01T15:41:00Z" }),
      entry({ id: "local-b", actionKey: "HOUSEHOLD_REGISTER", timestamp: "2026-01-01T15:44:00Z" }),
    ],
  });

  assert.deepEqual(rows.map((row) => row.household_id), ["local-b", "local-a", "synced"]);
});

test("pending registrations respect oldest-first and edits retain registration order", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [
      { ...activeRow("synced"), registered_at: "2026-01-01T15:02:00Z" },
      { ...activeRow("edited"), registered_at: "2026-01-01T13:00:00Z" },
    ],
    recordStatus: "active",
    sortOrder: "oldest",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [
      entry({ id: "local-a", actionKey: "HOUSEHOLD_REGISTER", timestamp: "2026-01-01T15:44:00Z" }),
      entry({ id: "edited", actionKey: "HOUSEHOLD_UPDATE", status: "PENDING", timestamp: "2026-01-01T16:00:00Z" }),
    ],
  });

  assert.deepEqual(rows.map((row) => row.household_id), ["edited", "synced", "local-a"]);
  assert.equal(rows.find((row) => row.household_id === "edited").sync_status, "PENDING");
});
