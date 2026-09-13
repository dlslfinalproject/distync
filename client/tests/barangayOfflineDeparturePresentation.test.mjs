import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveEffectiveMasterlistRows } from "../src/features/masterlist/barangayMasterlistUi.js";

const pageSource = await readFile(
  new URL("../src/pages/barangay/BarangayMasterlistPage.jsx", import.meta.url),
  "utf8",
);

const row = (id, overrides = {}) => ({
  household_id: id,
  masterlist_record_id: id,
  family_head_name: "Maria Santos",
  is_active: true,
  is_operationally_active: true,
  can_record_departure: true,
  offline_household_details: {
    household: {
      id,
      family_head_first_name: "Maria",
      family_head_last_name: "Santos",
    },
    members: [],
  },
  ...overrides,
});

const departure = ({ id, event = "event-a", barangay = "barangay-a", status = "PENDING" }) => ({
  id: `sync-${id}-${event}-${barangay}`,
  actionKey: "HOUSEHOLD_DEPART",
  entityType: "HOUSEHOLD",
  entityServerId: id,
  entityLocalId: id,
  status,
  clientTimestamp: "2026-09-13T06:00:00.000Z",
  barangayId: barangay,
  payload: { disaster_event_id: event, barangay_id: barangay },
});

test("offline departure modal keeps cached row name when detail snapshot has no name", () => {
  assert.match(pageSource, /String\(row\.household_id\) === String\(pendingDepartureHouseholdId\)/);
  assert.match(pageSource, /pendingDepartureDetailsFamilyHeadName \|\| pendingDepartureRow\?\.family_head_name/);
  assert.match(pageSource, /resolveFamilyHeadPhoto\(pendingDepartureRow\?\.offline_household_details/);
});

test("missing family-head photo does not remove the offline family-head name", () => {
  const [archived] = resolveEffectiveMasterlistRows({
    rows: [row("household-1", { offline_household_details: { household: {}, members: [] } })],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure({ id: "household-1" })],
  });

  assert.equal(archived.family_head_name, "Maria Santos");
  assert.equal(archived.departure_time_value, "2026-09-13T06:00:00.000Z");
});

test("pending departure is archived after refresh using durable row and queue state", () => {
  const entries = [departure({ id: "household-1" })];
  const active = resolveEffectiveMasterlistRows({
    rows: [row("household-1")],
    recordStatus: "active",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: entries,
  });
  const archived = resolveEffectiveMasterlistRows({
    rows: [row("household-1")],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: entries,
  });

  assert.equal(active.length, 0);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].departure_sync_status, "PENDING");
  assert.equal(archived[0].departure_time_value, entries[0].clientTimestamp);
});

test("successful synchronization remains archived without a synthetic duplicate", () => {
  const synced = resolveEffectiveMasterlistRows({
    rows: [row("household-1", { is_active: false, is_operationally_active: false, departure_time_value: "2026-09-13T05:59:00.000Z" })],
    recordStatus: "archived",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure({ id: "household-1", status: "SYNCED" })],
  });

  assert.equal(synced.length, 1);
  assert.equal(synced[0].departure_sync_status, "SYNCED");
  assert.equal(synced.filter((item) => item.is_local_only).length, 0);
});

test("departure overlay matches the exact occurrence and scope", () => {
  const rows = resolveEffectiveMasterlistRows({
    rows: [row("old-occurrence"), row("new-occurrence")],
    recordStatus: "all",
    selectedEventId: "event-a",
    assignedBarangayId: "barangay-a",
    syncQueueEntries: [departure({ id: "old-occurrence" })],
  });

  assert.equal(rows.find((item) => item.household_id === "old-occurrence").is_operationally_active, false);
  assert.equal(rows.find((item) => item.household_id === "new-occurrence").is_operationally_active, true);
  assert.equal(
    resolveEffectiveMasterlistRows({
      rows: [row("old-occurrence")],
      recordStatus: "active",
      selectedEventId: "event-b",
      assignedBarangayId: "barangay-a",
      syncQueueEntries: [departure({ id: "old-occurrence" })],
    }).length,
    1,
  );
  assert.equal(
    resolveEffectiveMasterlistRows({
      rows: [row("old-occurrence")],
      recordStatus: "active",
      selectedEventId: "event-a",
      assignedBarangayId: "barangay-b",
      syncQueueEntries: [departure({ id: "old-occurrence" })],
    }).length,
    1,
  );
});
