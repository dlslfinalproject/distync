import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { buildMswdoOfflineMasterlistPayload } from "../src/features/mswdo-masterlist/mswdoMasterlistOffline.js";

const read = (file) => fs.readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

const mappedRow = (household) => ({
  household_id: household.household_id,
  barangay_id: household.barangay_id,
  barangay_name: household.barangay_name,
  family_head_name: household.family_head_name,
  members_count: household.members_count,
  sector_codes: household.sector_codes || [],
  sectors_text: household.sectors_text || "-",
  registered_at: household.registered_at,
  arrival_time_text: household.arrival_time_text || household.registered_at,
  departure_time_value: household.departure_time_value || null,
  is_active: household.is_active !== false,
  is_operationally_active: household.is_operationally_active !== false,
  can_record_departure: household.can_record_departure !== false,
  offline_household_details: household.offline_household_details,
});

const base = {
  filters: { disaster_event_id: "event-1" },
  disaster_event: { id: "event-1", title: "Flood" },
};

test("MSWDO Stage 3 records the full Barangay behavior classification", async () => {
  const source = await read("features/mswdo-masterlist/mswdoMasterlistOffline.js");
  for (const behavior of [
    "syncQueueEntries",
    "resolveEffectiveMasterlistRows",
    "offline_projected_rows",
    "offline_all_projected_rows",
  ]) {
    assert.match(source, new RegExp(behavior));
  }
});

test("MSWDO offline departure uses the shared effective lifecycle projection", () => {
  const result = buildMswdoOfflineMasterlistPayload({
    households: [{
      household_id: "household-1",
      barangay_id: "barangay-1",
      family_head_name: "Ana Cruz",
      members_count: 2,
      registered_at: "2026-09-10T08:00:00.000Z",
      offline_household_details: { household: { id: "household-1", household_size: 2 }, members: [{ id: "m1" }, { id: "m2" }] },
    }],
    mapRow: mappedRow,
    basePayload: base,
    syncQueueEntries: [{
      id: "sync-1",
      entityType: "HOUSEHOLD",
      entityServerId: "household-1",
      actionKey: "HOUSEHOLD_DEPART",
      status: "PENDING",
      clientTimestamp: "2026-09-10T09:00:00.000Z",
      payload: { disaster_event_id: "event-1", barangay_id: "barangay-1" },
    }],
    recordStatus: "archived",
    pageSize: 25,
  });

  assert.equal(result.count, 1);
  assert.equal(result.offline_projected_rows[0].is_operationally_active, false);
  assert.equal(result.offline_projected_rows[0].departure_sync_status, "PENDING");
  assert.equal(result.data[0].household_id, "household-1");
});

test("MSWDO offline registration projection appears once and respects Barangay filtering", () => {
  const result = buildMswdoOfflineMasterlistPayload({
    households: [],
    mapRow: mappedRow,
    basePayload: base,
    selectedBarangayId: "barangay-2",
    syncQueueEntries: [{
      id: "sync-register-1",
      entityType: "HOUSEHOLD",
      entityLocalId: "local-1",
      actionKey: "HOUSEHOLD_REGISTER",
      status: "PENDING",
      clientTimestamp: "2026-09-10T09:00:00.000Z",
      payload: {
        disaster_event_id: "event-1",
        barangay_id: "barangay-2",
        barangay_name: "Barangay 2",
        family_head: { first_name: "Ben", last_name: "Cruz" },
      },
    }],
    recordStatus: "active",
    pageSize: 25,
  });

  assert.equal(result.count, 1);
  assert.equal(result.offline_projected_rows[0].household_id, "local-1");
  assert.equal(result.offline_projected_rows[0].sync_status, "PENDING");
});
