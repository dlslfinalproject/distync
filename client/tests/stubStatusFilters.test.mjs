import test from "node:test";
import assert from "node:assert/strict";

import {
  getStubRowStatusFilter,
  matchesStubStatusFilter,
  normalizeStubStatusFilter,
  STATUS_FILTERS,
} from "../src/features/stubs/stubStatusFilters.js";

test("normalizeStubStatusFilter keeps explicit all and maps legacy empty values safely", () => {
  assert.equal(normalizeStubStatusFilter(STATUS_FILTERS.ALL), STATUS_FILTERS.ALL);
  assert.equal(normalizeStubStatusFilter(""), STATUS_FILTERS.ALL);
  assert.equal(normalizeStubStatusFilter(null), STATUS_FILTERS.ALL);
  assert.equal(
    normalizeStubStatusFilter(STATUS_FILTERS.UNCLAIMED),
    STATUS_FILTERS.UNCLAIMED,
  );
  assert.equal(normalizeStubStatusFilter("ISSUED"), STATUS_FILTERS.UNCLAIMED);
});

test("getStubRowStatusFilter maps UI filters to stored stub statuses", () => {
  assert.equal(getStubRowStatusFilter(STATUS_FILTERS.ALL), null);
  assert.equal(getStubRowStatusFilter(STATUS_FILTERS.CLAIMED), "CLAIMED");
  assert.equal(getStubRowStatusFilter(STATUS_FILTERS.UNCLAIMED), "ISSUED");
});

test("matchesStubStatusFilter returns both claimed and unclaimed rows for all", () => {
  assert.equal(matchesStubStatusFilter("CLAIMED", STATUS_FILTERS.ALL), true);
  assert.equal(matchesStubStatusFilter("ISSUED", STATUS_FILTERS.ALL), true);
  assert.equal(matchesStubStatusFilter("CLAIMED", STATUS_FILTERS.CLAIMED), true);
  assert.equal(matchesStubStatusFilter("ISSUED", STATUS_FILTERS.CLAIMED), false);
  assert.equal(matchesStubStatusFilter("ISSUED", STATUS_FILTERS.UNCLAIMED), true);
  assert.equal(matchesStubStatusFilter("CLAIMED", STATUS_FILTERS.UNCLAIMED), false);
});
