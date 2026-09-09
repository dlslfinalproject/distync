import test from "node:test";
import assert from "node:assert/strict";
import { deriveBarangayDashboardMetrics } from "../src/features/barangay-dashboard/barangayDashboardOfflineMetrics.js";

const row = (id, name, size, active = true, stay = "EVAC_CENTER", registeredAt = "2026-01-01") => ({
  household_id: id,
  family_head_name: name,
  members_count: size,
  current_stay_type: stay,
  is_operationally_active: active,
  registered_at: registeredAt,
  offline_household_details: {
    household: {
      id,
      household_size: size,
      family_head_first_name: name,
      current_stay_type: stay,
      is_active: active,
      registered_at: registeredAt,
    },
    members: Array.from({ length: size }, (_, index) => ({ id: `${id}-member-${index}` })),
  },
});

test("derives event totals from the complete cached dataset", () => {
  assert.deepEqual(deriveBarangayDashboardMetrics({
    rows: [row("1", "Ana", 2), row("2", "Ben", 3, false)],
  }), {
    total_evacuees_individuals: 5,
    total_families: 2,
    currently_admitted_evacuees: 2,
    total_departed_evacuees: 3,
  });
});

test("does not change totals when the caller supplies a page-sized subset", () => {
  const all = [row("1", "Ana", 2), row("2", "Ben", 3), row("3", "Cara", 1)];
  assert.equal(deriveBarangayDashboardMetrics({ rows: all }).total_families, 3);
  assert.equal(deriveBarangayDashboardMetrics({ rows: all.slice(0, 1) }).total_families, 1);
});

test("deduplicates historical occurrences using the server family identity", () => {
  assert.deepEqual(deriveBarangayDashboardMetrics({
    rows: [row("old", "Ana", 2, false, "EVAC_CENTER", "2026-01-01"), row("new", "Ana", 2, true, "EVAC_CENTER", "2026-01-02")],
  }), {
    total_evacuees_individuals: 2,
    total_families: 1,
    currently_admitted_evacuees: 2,
    total_departed_evacuees: 0,
  });
});

test("returns legitimate zeroes for a valid empty snapshot", () => {
  assert.deepEqual(deriveBarangayDashboardMetrics(), {
    total_evacuees_individuals: 0,
    total_families: 0,
    currently_admitted_evacuees: 0,
    total_departed_evacuees: 0,
  });
});
