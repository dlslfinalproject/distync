const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve(
  "../src/services/donatedReliefPackAssignment.service",
);
const dbPath = require.resolve("../src/config/db");
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const assignmentRepositoryPath = require.resolve(
  "../src/repositories/stubDonatedReliefPackAssignment.repository",
);

const withStubbedAssignmentService = async (stubs, runTest) => {
  const dependencyPaths = [
    dbPath,
    distributionTransactionRepositoryPath,
    assignmentRepositoryPath,
  ];
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      delete require.cache[modulePath];
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath],
      };
    });

    await runTest(require(servicePath));
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

const buildCandidateRows = ({ quantityAvailable = 4 } = {}) => [
  {
    donation_id: "donation-1",
    donor_name: "Donor One",
    donation_received_at: "2026-09-01T08:00:00.000Z",
    donation_created_at: "2026-09-01T08:00:00.000Z",
    donation_item_id: "donation-item-rice",
    inventory_item_id: "item-rice",
    inventory_batch_id: "batch-rice",
    quantity_received: 4,
    quantity_available: quantityAvailable,
    remarks: "Relief Pack: Acer at Your Service Pack x 2",
    batch_no: "DON-RICE-1",
    item_code: "RICE",
    item_name: "Rice",
    category: "Food",
    unit_of_measure: "kg",
    reorder_level: 0,
    expiration_date: null,
    status: "AVAILABLE",
  },
  {
    donation_id: "donation-1",
    donor_name: "Donor One",
    donation_received_at: "2026-09-01T08:00:00.000Z",
    donation_created_at: "2026-09-01T08:00:00.000Z",
    donation_item_id: "donation-item-water",
    inventory_item_id: "item-water",
    inventory_batch_id: "batch-water",
    quantity_received: 4,
    quantity_available: quantityAvailable,
    remarks: "Relief Pack: Acer at Your Service Pack x 2",
    batch_no: "DON-WATER-1",
    item_code: "WATER",
    item_name: "Water",
    category: "Water",
    unit_of_measure: "bottle",
    reorder_level: 0,
    expiration_date: null,
    status: "AVAILABLE",
  },
];

const buildEligibleStubs = () => [
  {
    id: "stub-barangay-a",
    disaster_event_id: "event-1",
    household_id: "household-a",
    queue_time_in: "2026-09-01T09:00:00.000Z",
  },
  {
    id: "stub-barangay-b",
    disaster_event_id: "event-1",
    household_id: "household-b",
    queue_time_in: "2026-09-01T09:01:00.000Z",
  },
  {
    id: "stub-barangay-c",
    disaster_event_id: "event-1",
    household_id: "household-c",
    queue_time_in: "2026-09-01T09:02:00.000Z",
  },
];

test("donated relief packs reserve event-wide FIFO stubs across barangays", async () => {
  const insertedAssignments = [];
  const assignmentRepository = {
    lockDisasterEventForDonationAssignments: async () => ({
      id: "event-1",
      status: "ACTIVE",
    }),
    getEligibleUnclaimedStubsForDonationAssignments: async () =>
      buildEligibleStubs(),
    getActiveAssignmentsByEvent: async () => [],
    insertAssignment: async (assignment) => {
      insertedAssignments.push(assignment);
      return {
        ...assignment,
        id: `assignment-${insertedAssignments.length}`,
        assignment_status: "RESERVED",
      };
    },
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {
        getDonatedReliefPackItemsByDisasterEventId: async () =>
          buildCandidateRows(),
      },
      [assignmentRepositoryPath]: assignmentRepository,
    },
    async ({ ensureDonatedReliefPackAssignmentsForEvent }) => {
      const result = await ensureDonatedReliefPackAssignmentsForEvent("event-1", {
        query: async () => ({ rows: [] }),
      });

      assert.equal(result.length, 2);
      assert.deepEqual(
        insertedAssignments.map((assignment) => assignment.stub_id),
        ["stub-barangay-a", "stub-barangay-b"],
      );
      assert.equal(insertedAssignments[0].pack_name, "Acer at Your Service Pack");
      assert.equal(
        insertedAssignments[0].items_snapshot[0].quantity_reserved,
        2,
      );
    },
  );
});

test("reserved donated packs reduce the next FIFO capacity without consuming inventory yet", async () => {
  const insertedAssignments = [];
  const activeAssignments = [
    {
      stub_id: "stub-barangay-a",
      donation_id: "donation-1",
      pack_name: "Acer at Your Service Pack",
      pack_size: 2,
      assignment_status: "RESERVED",
      items_snapshot: [
        {
          inventory_batch_id: "batch-rice",
          quantity_reserved: 2,
        },
        {
          inventory_batch_id: "batch-water",
          quantity_reserved: 2,
        },
      ],
    },
  ];
  const assignmentRepository = {
    lockDisasterEventForDonationAssignments: async () => ({
      id: "event-1",
      status: "ACTIVE",
    }),
    getEligibleUnclaimedStubsForDonationAssignments: async () =>
      buildEligibleStubs().slice(0, 2),
    getActiveAssignmentsByEvent: async () => activeAssignments,
    insertAssignment: async (assignment) => {
      insertedAssignments.push(assignment);
      return { ...assignment, id: "assignment-b", assignment_status: "RESERVED" };
    },
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {
        getDonatedReliefPackItemsByDisasterEventId: async () =>
          buildCandidateRows(),
      },
      [assignmentRepositoryPath]: assignmentRepository,
    },
    async ({ ensureDonatedReliefPackAssignmentsForEvent }) => {
      await ensureDonatedReliefPackAssignmentsForEvent("event-1", {
        query: async () => ({ rows: [] }),
      });
    },
  );

  assert.deepEqual(
    insertedAssignments.map((assignment) => assignment.stub_id),
    ["stub-barangay-b"],
  );
});

test("claim plan uses the persisted assignment snapshot and keeps the donated source metadata", async () => {
  const assignment = {
    id: "assignment-1",
    stub_id: "stub-1",
    disaster_event_id: "event-1",
    donation_id: "donation-1",
    donor_name: "Donor One",
    pack_name: "Acer at Your Service Pack",
    pack_size: 2,
    assignment_status: "RESERVED",
    items_snapshot: [
      {
        inventory_batch_id: "batch-rice",
        inventory_item_id: "item-rice",
        donation_item_id: "donation-item-rice",
        quantity_reserved: 2,
        item_name: "Rice",
        category: "Food",
        unit_of_measure: "kg",
      },
    ],
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {
        getInventoryBatchByIdForUpdate: async () => ({
          id: "batch-rice",
          inventory_item_id: "item-rice",
          source_type: "DONATED",
          quantity_available: 2,
          status: "AVAILABLE",
          expiration_date: null,
          batch_no: "DON-RICE-1",
          item_code: "RICE",
          item_name: "Rice",
          category: "Food",
          unit_of_measure: "kg",
        }),
      },
      [assignmentRepositoryPath]: {
        getAssignmentsByStubIds: async () => [assignment],
      },
    },
    async ({ getDonatedReliefPackClaimPlanForStub }) => {
      const plan = await getDonatedReliefPackClaimPlanForStub({
        stubId: "stub-1",
        disasterEventId: "event-1",
        client: { query: async () => ({ rows: [] }) },
      });

      assert.equal(plan.hasPersistedAssignment, true);
      assert.equal(plan.donatedReliefPacks[0].name, "Acer at Your Service Pack");
      assert.equal(plan.allocations[0].source_relief_type, "DONATED_RELIEF_PACK");
      assert.equal(plan.allocations[0].quantity_released, 2);
      assert.equal(plan.allocations[0].donor_name, "Donor One");
    },
  );
});

test("donated relief pack claim allocation uses the locked batch expiration", async () => {
  const assignment = {
    id: "assignment-expiry",
    stub_id: "stub-expiry",
    disaster_event_id: "event-1",
    donation_id: "donation-1",
    donor_name: "Donor One",
    pack_name: "Acer at Your Service Pack",
    pack_size: 1,
    assignment_status: "RESERVED",
    items_snapshot: [
      {
        inventory_batch_id: "batch-rice",
        inventory_item_id: "item-rice",
        donation_item_id: "donation-item-rice",
        quantity_reserved: 2,
        expiration_date: "2099-12-31",
        item_name: "Rice",
        category: "Food",
        unit_of_measure: "kg",
      },
    ],
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {
        getInventoryBatchByIdForUpdate: async () => ({
          id: "batch-rice",
          inventory_item_id: "item-rice",
          source_type: "DONATED",
          quantity_available: 2,
          status: "AVAILABLE",
          expiration_date: null,
          batch_no: "DON-RICE-1",
          item_code: "RICE",
          item_name: "Rice",
          category: "Food",
          unit_of_measure: "kg",
        }),
      },
      [assignmentRepositoryPath]: {
        getAssignmentsByStubIds: async () => [assignment],
      },
    },
    async ({ getDonatedReliefPackClaimPlanForStub }) => {
      const plan = await getDonatedReliefPackClaimPlanForStub({
        stubId: "stub-expiry",
        disasterEventId: "event-1",
        client: { query: async () => ({ rows: [] }) },
      });

      assert.equal(plan.allocations[0].expiration_date, null);
    },
  );
});

test("claim plan ignores a donated assignment from another disaster event", async () => {
  const assignmentLookupOptions = [];
  const assignment = {
    id: "assignment-other-event",
    stub_id: "stub-1",
    disaster_event_id: "event-2",
    donation_id: "donation-2",
    pack_name: "Other Event Pack",
    pack_size: 1,
    assignment_status: "RESERVED",
    items_snapshot: [],
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {},
      [assignmentRepositoryPath]: {
        getAssignmentsByStubIds: async (_stubIds, _client, options) => {
          assignmentLookupOptions.push(options);
          return [assignment];
        },
      },
    },
    async ({ getDonatedReliefPackClaimPlanForStub }) => {
      const plan = await getDonatedReliefPackClaimPlanForStub({
        stubId: "stub-1",
        disasterEventId: "event-1",
        client: { query: async () => ({ rows: [] }) },
      });

      assert.deepEqual(assignmentLookupOptions, [
        {
          includeReleased: false,
          forUpdate: true,
          disasterEventId: "event-1",
        },
      ]);
      assert.equal(plan.hasPersistedAssignment, false);
      assert.deepEqual(plan.donatedReliefPacks, []);
      assert.deepEqual(plan.allocations, []);
    },
  );
});

test("claim completion marks donated assignments for the requested disaster event", async () => {
  let markArguments = null;
  const assignmentRepository = {
    markAssignmentsClaimedForStub: async (...args) => {
      markArguments = args;
      return [];
    },
  };

  await withStubbedAssignmentService(
    {
      [dbPath]: {},
      [distributionTransactionRepositoryPath]: {},
      [assignmentRepositoryPath]: assignmentRepository,
    },
    async ({ markDonatedReliefPackAssignmentsClaimed }) => {
      const client = { query: async () => ({ rows: [] }) };
      await markDonatedReliefPackAssignmentsClaimed(
        "stub-1",
        "event-1",
        client,
      );

      assert.deepEqual(markArguments, [
        "stub-1",
        client,
        { disasterEventId: "event-1" },
      ]);
    },
  );
});
