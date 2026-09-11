import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { buildMswdoOfflineMasterlistPayload } from "../src/features/mswdo-masterlist/mswdoMasterlistOffline.js";

const read = (relativePath) =>
  fs.readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const row = (household) => ({
  household_id: household.household_id,
  masterlist_record_id: household.masterlist_record_id || household.household_id,
  family_head_name: household.family_head_name,
  barangay_id: household.barangay_id,
  barangay_name: household.barangay_name,
  registered_at: household.registered_at,
  arrival_time_text: household.arrival_time_text || household.registered_at,
  departure_time_value: household.departure_time_value || null,
  departure_time_text: household.departure_time_text || "-",
  sectors_text: household.sectors_text || "-",
  sector_codes: household.sector_codes || [],
  members_count: household.members_count || 1,
  is_active: household.is_active !== false,
  is_operationally_active: household.is_operationally_active !== false,
  can_record_departure: household.can_record_departure !== false,
});

const basePayload = {
  disaster_event: { id: "event-1", title: "Flood" },
  filters: { disaster_event_id: "event-1" },
};

const pendingDeparture = {
  id: "sync-depart-1",
  entityType: "HOUSEHOLD",
  entityServerId: "household-1",
  actionKey: "HOUSEHOLD_DEPART",
  status: "PENDING",
  clientTimestamp: "2026-09-11T11:00:00.000Z",
  payload: { disaster_event_id: "event-1", barangay_id: "barangay-1" },
};

test("DEP-RUNTIME-01/02/03 pending departure reaches the MSWDO table rows exactly once", () => {
  const payload = buildMswdoOfflineMasterlistPayload({
    households: [{
      household_id: "household-1",
      family_head_name: "Ana Cruz",
      barangay_id: "barangay-1",
      registered_at: "2026-09-11T08:00:00.000Z",
    }],
    mapRow: row,
    basePayload,
    syncQueueEntries: [pendingDeparture],
    recordStatus: "archived",
    pageSize: 25,
  });

  assert.equal(payload.offline_projected_rows.length, 1);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].household_id, "household-1");
  const tableRows = payload.offline_projected_rows;
  assert.equal(tableRows[0].is_operationally_active, false);
  assert.equal(tableRows[0].departure_sync_detailed_status, "PENDING");

  const activePayload = buildMswdoOfflineMasterlistPayload({
    households: [{ household_id: "household-1", family_head_name: "Ana Cruz" }],
    mapRow: row,
    basePayload,
    syncQueueEntries: [pendingDeparture],
    recordStatus: "active",
  });
  assert.equal(activePayload.data.length, 0);
});

test("DEP-RUNTIME-04 projects before pagination and preserves canonical departure ordering", () => {
  const households = [
    { household_id: "older", family_head_name: "Older", departure_time_value: "2026-09-11T09:00:00.000Z", is_operationally_active: false },
    { household_id: "middle", family_head_name: "Middle", departure_time_value: "2026-09-11T10:00:00.000Z", is_operationally_active: false },
    { household_id: "active", family_head_name: "Active", registered_at: "2026-09-11T12:00:00.000Z" },
  ];
  const payload = buildMswdoOfflineMasterlistPayload({
    households,
    mapRow: row,
    basePayload,
    syncQueueEntries: [{ ...pendingDeparture, entityServerId: "active" }],
    recordStatus: "archived",
    currentPage: 1,
    pageSize: 1,
  });

  assert.equal(payload.pagination.totalItems, 3);
  assert.equal(payload.offline_projected_rows[0].household_id, "active");
});

test("DEP-RUNTIME-05 search and Barangay filtering operate on the projected rows", () => {
  const payload = buildMswdoOfflineMasterlistPayload({
    households: [{
      household_id: "household-1",
      family_head_name: "Ana Cruz",
      barangay_id: "barangay-1",
      registered_at: "2026-09-11T08:00:00.000Z",
    }],
    mapRow: row,
    basePayload,
    selectedBarangayId: "barangay-1",
    searchTerm: "Ana",
    recordStatus: "archived",
    syncQueueEntries: [pendingDeparture],
  });

  assert.deepEqual(payload.data.map((item) => item.household_id), ["household-1"]);
});

test("DEP-RUNTIME-06 MSWDO Archived uses the complete dataset before local rendering", async () => {
  const source = await read("src/features/mswdo-masterlist/useMswdoMasterlist.js");
  const service = await read("src/features/mswdo-masterlist/mswdoMasterlistService.js");

  assert.match(source, /completeDataset: recordStatus === "archived"/);
  assert.match(source, /recordStatus === "archived" && !payload\.pagination/);
  assert.match(source, /buildMswdoOfflineMasterlistPayload/);
  assert.match(service, /completeDataset = false/);
  assert.match(service, /!completeDataset && page !== undefined && pageSize !== undefined/);
});

test("DEP-SYNC-ORDER-01/02/03/05 authoritative sync keeps one row and canonical position", () => {
  const payload = buildMswdoOfflineMasterlistPayload({
    households: [
      { household_id: "a", family_head_name: "A", departure_time_value: "2026-09-11T09:00:00.000Z", is_operationally_active: false },
      { household_id: "b", family_head_name: "B", departure_time_value: "2026-09-11T10:00:00.000Z", is_operationally_active: false },
      { household_id: "c", family_head_name: "C", departure_time_value: "2026-09-11T11:00:00.000Z", is_operationally_active: false },
    ],
    mapRow: row,
    basePayload,
    recordStatus: "archived",
    pageSize: 25,
    syncQueueEntries: [{
      ...pendingDeparture,
      entityServerId: "c",
      status: "SYNCED",
    }],
  });

  assert.deepEqual(payload.offline_projected_rows.map((item) => item.household_id), ["c", "b", "a"]);
  assert.equal(payload.offline_projected_rows.filter((item) => item.household_id === "c").length, 1);
  assert.equal(payload.offline_projected_rows[0].departure_sync_detailed_status, "SYNCED");
});

test("DEP-SYNC-ORDER-06 older offline departure follows its original timestamp", () => {
  const payload = buildMswdoOfflineMasterlistPayload({
    households: [
      { household_id: "newer", family_head_name: "Newer", departure_time_value: "2026-09-11T11:00:00.000Z", is_operationally_active: false },
      { household_id: "older", family_head_name: "Older", registered_at: "2026-09-11T08:00:00.000Z" },
    ],
    mapRow: row,
    basePayload,
    recordStatus: "archived",
    syncQueueEntries: [{
      ...pendingDeparture,
      entityServerId: "older",
      clientTimestamp: "2026-09-11T08:30:00.000Z",
    }],
  });

  assert.deepEqual(payload.offline_projected_rows.map((item) => item.household_id), ["newer", "older"]);
  assert.equal(payload.offline_projected_rows[1].departure_time_value, "2026-09-11T08:30:00.000Z");
});
