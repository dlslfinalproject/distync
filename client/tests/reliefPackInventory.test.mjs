import assert from "node:assert/strict";
import test from "node:test";

import {
  isReliefPackInventoryBatchEligible,
  RELIEF_PACK_INVENTORY_SOURCE_TYPE,
  sortDisasterEventsForReliefPackRollover,
} from "../src/features/relief-pack-templates/reliefPackInventory.js";

const referenceDate = new Date(2026, 7, 28);

const buildBatch = (overrides = {}) => ({
  inventory_item_id: "item-1",
  source_type: RELIEF_PACK_INVENTORY_SOURCE_TYPE,
  status: "AVAILABLE",
  quantity_available: 10,
  expiration_date: null,
  ...overrides,
});

test("relief-pack inventory accepts available LGU stock without an expiry date", () => {
  assert.equal(
    isReliefPackInventoryBatchEligible(buildBatch(), referenceDate),
    true,
  );
});

test("relief-pack inventory excludes donated and non-LGU stock", () => {
  for (const sourceType of ["PURCHASED", "DSWD", "OTHER", ""]) {
    assert.equal(
      isReliefPackInventoryBatchEligible(
        buildBatch({ source_type: sourceType }),
        referenceDate,
      ),
      false,
      `source type ${sourceType || "blank"} should be excluded`,
    );
  }

  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({
        source_type: "DONATED",
        source_donation_type: "RELIEF_PACK",
        source_donation_disaster_event_id: "event-1",
      }),
      referenceDate,
    ),
    false,
  );
});

test("relief-pack inventory accepts loose donated stock for an active event", () => {
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({
        source_type: "DONATED",
        source_donation_type: "LOOSE_ITEM",
        source_donation_status: "RECEIVED",
        source_donation_disaster_event_id: "event-1",
      }),
      referenceDate,
      { activeDisasterEventIds: ["event-1"] },
    ),
    true,
  );
});

test("relief-pack inventory does not borrow loose donations from another active event", () => {
  const disasterEvents = [
    {
      id: "event-a",
      status: "ACTIVE",
      created_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "event-b",
      status: "ACTIVE",
      created_at: "2026-08-02T00:00:00.000Z",
    },
  ];

  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({
        source_type: "DONATED",
        source_donation_type: "LOOSE_ITEM",
        source_donation_status: "RECEIVED",
        source_donation_disaster_event_id: "event-b",
      }),
      referenceDate,
      {
        targetDisasterEventId: "event-a",
        disasterEvents,
      },
    ),
    false,
  );
});

test("relief-pack inventory rolls a closed event donation to the earliest later active event", () => {
  const disasterEvents = [
    {
      id: "source-event",
      status: "CLOSED",
      created_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "next-event",
      status: "ACTIVE",
      created_at: "2026-08-02T00:00:00.000Z",
    },
    {
      id: "later-event",
      status: "ACTIVE",
      created_at: "2026-08-03T00:00:00.000Z",
    },
  ];
  const batch = buildBatch({
    source_type: "DONATED",
    source_donation_type: "LOOSE_ITEM",
    source_donation_status: "PARTIALLY_DISTRIBUTED",
    source_donation_disaster_event_id: "source-event",
  });

  assert.equal(
    isReliefPackInventoryBatchEligible(batch, referenceDate, {
      targetDisasterEventId: "next-event",
      disasterEvents,
    }),
    true,
  );
  assert.equal(
    isReliefPackInventoryBatchEligible(batch, referenceDate, {
      targetDisasterEventId: "later-event",
      disasterEvents,
    }),
    false,
  );
});

test("relief-pack rollover event ordering uses creation time with a stable id tie-breaker", () => {
  const sortedEvents = sortDisasterEventsForReliefPackRollover([
    { id: "event-b", created_at: "2026-08-02T00:00:00.000Z" },
    { id: "event-a", created_at: "2026-08-01T00:00:00.000Z" },
  ]);

  assert.deepEqual(
    sortedEvents.map((event) => event.id),
    ["event-a", "event-b"],
  );
});

test("relief-pack inventory excludes loose donations outside active events or cancelled donations", () => {
  const baseLooseDonation = {
    source_type: "DONATED",
    source_donation_type: "LOOSE_ITEM",
    source_donation_status: "RECEIVED",
    source_donation_disaster_event_id: "event-1",
  };

  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({
        ...baseLooseDonation,
        source_donation_disaster_event_id: "event-2",
      }),
      referenceDate,
      { activeDisasterEventIds: ["event-1"] },
    ),
    false,
  );
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({
        ...baseLooseDonation,
        source_donation_status: "CANCELLED",
      }),
      referenceDate,
      { activeDisasterEventIds: ["event-1"] },
    ),
    false,
  );
});

test("relief-pack inventory excludes unavailable, empty, and invalid batches", () => {
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({ status: "EXPIRED" }),
      referenceDate,
    ),
    false,
  );
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({ quantity_available: 0 }),
      referenceDate,
    ),
    false,
  );
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({ quantity_available: "not-a-number" }),
      referenceDate,
    ),
    false,
  );
  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({ expiration_date: "not-a-date" }),
      referenceDate,
    ),
    false,
  );
});

test("relief-pack inventory excludes expired and near-expiry dates through the 30-day cutoff", () => {
  for (const expirationDate of ["2026-08-27", "2026-08-28", "2026-09-27"]) {
    assert.equal(
      isReliefPackInventoryBatchEligible(
        buildBatch({ expiration_date: expirationDate }),
        referenceDate,
      ),
      false,
      `expiration date ${expirationDate} should be excluded`,
    );
  }

  assert.equal(
    isReliefPackInventoryBatchEligible(
      buildBatch({ expiration_date: "2026-09-28" }),
      referenceDate,
    ),
    true,
  );
});
