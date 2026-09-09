import assert from "node:assert/strict";
import test from "node:test";
import { buildMswdoOfflineMasterlistPayload } from "../src/features/mswdo-masterlist/mswdoMasterlistOffline.js";

const rows = [
  { id: "a", barangay_id: "santiago", barangay_name: "Santiago", family_head_name: "Dela Cruz", registered_at: "2026-01-04", is_operationally_active: true, sector_codes: ["ADULT"] },
  { id: "b", barangay_id: "santiago", barangay_name: "Santiago", family_head_name: "Santos", registered_at: "2026-01-03", is_operationally_active: true, sector_codes: [] },
  { id: "c", barangay_id: "bagong-pook", barangay_name: "Bagong Pook", family_head_name: "Reyes", registered_at: "2026-01-02", is_operationally_active: true, sector_codes: [] },
  { id: "d", barangay_id: "san-andres", barangay_name: "San Andres", family_head_name: "Garcia", registered_at: "2026-01-01", is_operationally_active: true, sector_codes: [] },
];

const project = (input) =>
  buildMswdoOfflineMasterlistPayload({
    households: input,
    mapRow: (row) => row,
    recordStatus: "all",
    pageSize: 25,
  });

const ids = (payload) => payload.data.map((row) => row.id);

test("offline All Barangays returns the complete cached dataset", () => {
  assert.deepEqual(ids(project(rows)), ["a", "b", "c", "d"]);
});

test("offline specific Barangay uses the stable barangay ID", () => {
  assert.deepEqual(ids(buildMswdoOfflineMasterlistPayload({
    households: rows,
    mapRow: (row) => row,
    selectedBarangayId: "santiago",
    recordStatus: "all",
  })), ["a", "b"]);
});

test("offline switching Barangays and returning to All is local and cache-safe", () => {
  const before = structuredClone(rows);
  assert.deepEqual(ids(buildMswdoOfflineMasterlistPayload({ households: rows, mapRow: (row) => row, selectedBarangayId: "bagong-pook", recordStatus: "all" })), ["c"]);
  assert.deepEqual(ids(project(rows)), ["a", "b", "c", "d"]);
  assert.deepEqual(rows, before);
});

test("offline filters the full dataset before pagination and composes with search", () => {
  const payload = buildMswdoOfflineMasterlistPayload({
    households: [
      ...rows,
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `s${index}`,
        barangay_id: "santiago",
        barangay_name: "Santiago",
        family_head_name: `Santiago Family ${index}`,
        registered_at: `2025-12-${String((index % 9) + 1).padStart(2, "0")}`,
        is_operationally_active: true,
        sector_codes: [],
      })),
    ],
    mapRow: (row) => row,
    selectedBarangayId: "santiago",
    searchTerm: "Dela Cruz",
    recordStatus: "all",
    currentPage: 1,
    pageSize: 1,
  });
  assert.deepEqual(ids(payload), ["a"]);
  assert.equal(payload.pagination.totalItems, 1);
});

test("offline specific empty and unknown Barangays stay empty", () => {
  for (const selectedBarangayId of ["empty", "unknown"]) {
    const payload = buildMswdoOfflineMasterlistPayload({
      households: rows,
      mapRow: (row) => row,
      selectedBarangayId,
      recordStatus: "all",
    });
    assert.deepEqual(ids(payload), []);
    assert.equal(payload.pagination.totalItems, 0);
  }
});
