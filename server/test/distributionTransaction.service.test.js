const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/distributionTransaction.service");
const dbPath = require.resolve("../src/config/db");
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const disasterEventRepositoryPath = require.resolve(
  "../src/repositories/disasterEvent.repository",
);
const reliefPackTemplateRepositoryPath = require.resolve(
  "../src/repositories/reliefPackTemplate.repository",
);
const notificationServicePath = require.resolve(
  "../src/modules/notifications/notification.service",
);
const stubRepositoryPath = require.resolve("../src/repositories/stub.repository");
const settingsRepositoryPath = require.resolve("../src/repositories/settings.repository");
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const automaticReliefPackClaimServicePath = require.resolve(
  "../src/services/automaticReliefPackClaim.service",
);
const reliefPackAssignmentServicePath = require.resolve(
  "../src/services/reliefPackAssignment.service",
);
const systemLogPath = require.resolve("../src/utils/systemLog");
const mswdoReportExportPath = require.resolve("../src/utils/mswdoReportExport");

const withStubbedDistributionService = async (stubs, runTest) => {
  const dependencyPaths = Object.keys(stubs);
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

    const distributionTransactionService = require(servicePath);
    return await runTest(distributionTransactionService);
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

const createFakePool = (events) => ({
  connect: async () => ({
    query: async (sql) => {
      if (typeof sql === "string" && sql === "BEGIN") {
        events.push("BEGIN");
      }

      if (typeof sql === "string" && sql === "ROLLBACK") {
        events.push("ROLLBACK");
      }

      if (typeof sql === "string" && sql === "COMMIT") {
        events.push("COMMIT");
      }

      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  }),
});

const baseStub = {
  id: "22222222-2222-4222-8222-222222222222",
  disaster_event_id: "33333333-3333-4333-8333-333333333333",
  household_id: "44444444-4444-4444-8444-444444444444",
  stub_no: "STUB-001",
  serial_no: "SER-001",
  status: "CLAIMED",
  claimed_at: "2026-08-08T01:00:00.000Z",
  barangay_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  qr_code_value: "DISTYNC-STUB|event|household|stub|STUB-001",
  disaster_event_status: "ACTIVE",
};

const baseRequest = {
  stub_id: baseStub.id,
  disaster_event_id: baseStub.disaster_event_id,
  household_id: baseStub.household_id,
  claimed_by_name: "Local Claimant",
  verified_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  requester: {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    roleCode: "BARANGAY",
    defaultBarangayId: baseStub.barangay_id,
  },
};

const createBaseStubs = ({
  events,
  stub = baseStub,
  claimHandler = null,
  latestAttendance = {
    status: "PRESENT",
    time_out: null,
  },
  disasterEvent = {
    id: baseStub.disaster_event_id,
    status: "ACTIVE",
    disaster_type: "Typhoon",
  },
}) => ({
  [dbPath]: createFakePool(events),
  [distributionTransactionRepositoryPath]: {
    getStubByIdForUpdate: async () => stub,
    getLatestAttendanceByHouseholdId: async (...args) =>
      typeof latestAttendance === "function"
        ? latestAttendance(...args)
        : latestAttendance,
  },
  [disasterEventRepositoryPath]: {
    getDisasterEventById: async () => disasterEvent,
  },
  [reliefPackTemplateRepositoryPath]: {},
  [notificationServicePath]: {
    emitSafely: async () => {},
    emitDistributionUpdate: async () => {},
    emitBatchAlerts: async () => {},
  },
  [stubRepositoryPath]: {
    getLatestDistributionTransactionByStubId: async (stubId) => ({
      id: "55555555-5555-4555-8555-555555555555",
      stub_id: stubId,
      distribution_status: "CLAIMED",
      receipt_no: "RCPT-2026-000001",
      received_at: "2026-08-08T01:00:00.000Z",
    }),
  },
  [settingsRepositoryPath]: {},
  [inventoryItemRepositoryPath]: {},
  [automaticReliefPackClaimServicePath]: {
    recordAutomaticReliefPackClaim:
      claimHandler ||
      (async () => {
        throw new Error("claim handler should not run");
      }),
  },
  [reliefPackAssignmentServicePath]: {
    getPrimaryAssignedReliefPackTemplate: () => null,
    resolveAssignedReliefPackTemplatesForHousehold: async () => [],
  },
  [systemLogPath]: {
    logAuditSafely: async () => {},
    pickDefined: (value, keys) =>
      Object.fromEntries(keys.map((key) => [key, value?.[key]]).filter(([, item]) => item !== undefined)),
  },
  [mswdoReportExportPath]: {},
});

test("H05-02 createDistributionTransaction emits STUB_ALREADY_CLAIMED for an accepted claimed stub", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () => createDistributionTransaction(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_ALREADY_CLAIMED");
          assert.equal(error.statusCode, 409);
          assert.equal(error.entityServerId, baseStub.id);
          assert.equal(error.serverPayload.stub.status, "CLAIMED");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-03 claimDistributionTransactionFromQr emits STUB_ALREADY_CLAIMED for an accepted claimed stub", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({ events }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_ALREADY_CLAIMED");
          assert.equal(error.statusCode, 409);
          assert.equal(error.serverPayload.distribution_transaction.id, "55555555-5555-4555-8555-555555555555");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("H05-04 non-claimed invalid stub status remains a non-conflict validation error", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "CANCELLED",
      },
    }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "STUB_NOT_CLAIMABLE");
          assert.equal(error.statusCode, 400);
          assert.equal(error.message, "Stub is not claimable");
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

for (const constraint of [
  "uq_distribution_stub",
  "distribution_transactions_stub_id_key",
]) {
  test(`H05-05 distribution stub unique violation normalizes ${constraint}`, async () => {
    const events = [];

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
        },
        claimHandler: async () => {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          error.constraint = constraint;
          throw error;
        },
      }),
      async ({ claimDistributionTransactionFromQr }) => {
        await assert.rejects(
          () => claimDistributionTransactionFromQr(baseRequest),
          (error) => {
            assert.equal(error.code, "STUB_ALREADY_CLAIMED");
            assert.equal(error.statusCode, 409);
            assert.doesNotMatch(error.message, /23505|constraint/i);
            return true;
          },
        );
      },
    );

    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  });
}

test("H05-06 unrelated unique violations remain technical errors", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
      },
      claimHandler: async () => {
        const error = new Error("duplicate key value violates other unique constraint");
        error.code = "23505";
        error.constraint = "inventory_item_stock_forms_unique_packaging";
        throw error;
      },
    }),
    async ({ claimDistributionTransactionFromQr }) => {
      await assert.rejects(
        () => claimDistributionTransactionFromQr(baseRequest),
        (error) => {
          assert.equal(error.code, "23505");
          assert.equal(error.statusCode, undefined);
          assert.match(error.message, /other unique constraint/);
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("EE-FIX-03 createDistributionTransaction blocks new distributions when the event is not ACTIVE", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED", "ARCHIVED"]) {
    const events = [];
    let attendanceChecked = false;

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
          disaster_event_status: disasterEventStatus,
        },
        latestAttendance: async () => {
          attendanceChecked = true;
          return { status: "PRESENT", time_out: null };
        },
      }),
      async ({ createDistributionTransaction }) => {
        await assert.rejects(
          () => createDistributionTransaction(baseRequest),
          (error) => {
            assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
            assert.equal(error.statusCode, 400);
            return true;
          },
        );
      },
    );

    assert.equal(attendanceChecked, false);
    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  }
});

test("EE-FIX-03 claimDistributionTransactionFromQr blocks new QR claims when the event is not ACTIVE", async () => {
  for (const disasterEventStatus of ["PLANNED", "CLOSED", "ARCHIVED"]) {
    const events = [];
    let claimHandlerCalled = false;

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
          disaster_event_status: disasterEventStatus,
        },
        claimHandler: async () => {
          claimHandlerCalled = true;
          throw new Error("claim handler should not run for inactive events");
        },
      }),
      async ({ claimDistributionTransactionFromQr }) => {
        await assert.rejects(
          () =>
            claimDistributionTransactionFromQr({
              ...baseRequest,
              qr_reference_value: baseStub.qr_code_value,
            }),
          (error) => {
            assert.equal(error.code, "DISASTER_EVENT_NOT_ACTIVE");
            assert.equal(error.statusCode, 400);
            return true;
          },
        );
      },
    );

    assert.equal(claimHandlerCalled, false);
    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  }
});

test("relief-pack distribution requires a current PRESENT attendance record", async () => {
  const invalidAttendanceRecords = [
    {
      status: "LEFT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "ARRIVED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "TRANSFERRED",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: null,
    },
    {
      status: "PRESENT",
      time_in: "2026-08-28T08:00:00.000Z",
      time_out: "2026-08-28T12:00:00.000Z",
    },
    null,
  ];

  for (const latestAttendance of invalidAttendanceRecords) {
    const events = [];
    let releasePlanReached = false;

    await withStubbedDistributionService(
      createBaseStubs({
        events,
        stub: {
          ...baseStub,
          status: "ISSUED",
        },
        latestAttendance,
      }),
      async ({ createDistributionTransaction }) => {
        await assert.rejects(
          () => createDistributionTransaction(baseRequest),
          (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(
              error.message,
              "Only active evacuation-center households can claim a relief pack.",
            );
            releasePlanReached = true;
            return true;
          },
        );
      },
    );

    assert.equal(releasePlanReached, true);
    assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  }
});

test("assignment-driven distribution rejects the obsolete arbitrary item path", async () => {
  const events = [];

  await withStubbedDistributionService(
    createBaseStubs({
      events,
      stub: {
        ...baseStub,
        status: "ISSUED",
        current_stay_type: "EVAC_CENTER",
      },
    }),
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () =>
          createDistributionTransaction({
            ...baseRequest,
            items: [
              {
                inventory_batch_id: "11111111-1111-4111-8111-111111111111",
                inventory_item_id: "66666666-6666-4666-8666-666666666666",
                quantity_released: 1,
              },
            ],
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "RELIEF_PACK_TEMPLATE_REQUIRED");
          assert.equal(
            error.message,
            "relief_pack_template_id is required for assignment-driven distribution.",
          );
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("manual template distribution rejects a template that is not assigned to the household", async () => {
  const events = [];
  const assignedTemplate = {
    id: "template-assigned",
    name: "Assigned Standard Pack",
    is_active: true,
    is_additional_pack: false,
  };
  const stubs = createBaseStubs({
    events,
    stub: {
      ...baseStub,
      status: "ISSUED",
      current_stay_type: "EVAC_CENTER",
    },
  });

  stubs[reliefPackAssignmentServicePath] = {
    getPrimaryAssignedReliefPackTemplate: () => assignedTemplate,
    resolveAssignedReliefPackTemplatesForHousehold: async () => [
      assignedTemplate,
    ],
  };

  await withStubbedDistributionService(
    stubs,
    async ({ createDistributionTransaction }) => {
      await assert.rejects(
        () =>
          createDistributionTransaction({
            ...baseRequest,
            stub: undefined,
            stub_id: baseStub.id,
            relief_pack_template_id: "template-not-assigned",
            items: [],
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "RELIEF_PACK_TEMPLATE_NOT_ASSIGNED");
          assert.equal(
            error.message,
            "Selected relief pack template is not assigned to this family.",
          );
          return true;
        },
      );
    },
  );

  assert.deepEqual(events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("manual template distribution releases every assigned template with shared FIFO stock", async () => {
  const standardTemplateId = "template-standard";
  const additionalTemplateId = "template-additional";
  const sharedItemId = "item-shared";
  const standardItemId = "item-standard";
  const additionalItemId = "item-additional";
  const donatedSharedBatchId = "batch-donated-shared";
  const sharedBatchId = "batch-shared";
  const standardBatchId = "batch-standard";
  const additionalBatchId = "batch-additional";
  const assignedTemplates = [
    {
      id: standardTemplateId,
      name: "Standard Family Pack",
      is_active: true,
      is_additional_pack: false,
      based_on_family_size: false,
      applies_to_all_disasters: true,
    },
    {
      id: additionalTemplateId,
      name: "Senior Citizen Add-on",
      is_active: true,
      is_additional_pack: true,
      based_on_family_size: false,
      applies_to_all_disasters: true,
    },
  ];
  const inventoryItems = new Map([
    [
      sharedItemId,
      {
        id: sharedItemId,
        item_name: "Water",
        item_code: "WATER",
        unit_of_measure: "bottle",
        reorder_level: 0,
        is_active: true,
        packaging: "piece",
        quantity: 1,
        packaging_count: 5,
      },
    ],
    [
      standardItemId,
      {
        id: standardItemId,
        item_name: "Rice",
        item_code: "RICE",
        unit_of_measure: "kg",
        reorder_level: 0,
        is_active: true,
        packaging: "piece",
        quantity: 1,
        packaging_count: 2,
      },
    ],
    [
      additionalItemId,
      {
        id: additionalItemId,
        item_name: "Blanket",
        item_code: "BLANKET",
        unit_of_measure: "piece",
        reorder_level: 0,
        is_active: true,
        packaging: "piece",
        quantity: 1,
        packaging_count: 2,
      },
    ],
  ]);
  const templateItemsById = new Map([
    [
      standardTemplateId,
      [
        {
          inventory_item_id: sharedItemId,
          item_name: "Water",
          quantity_required: 2,
        },
        {
          inventory_item_id: standardItemId,
          item_name: "Rice",
          quantity_required: 1,
        },
      ],
    ],
    [
      additionalTemplateId,
      [
        {
          inventory_item_id: sharedItemId,
          item_name: "Water",
          quantity_required: 3,
        },
        {
          inventory_item_id: additionalItemId,
          item_name: "Blanket",
          quantity_required: 1,
        },
      ],
    ],
  ]);
  const batches = new Map([
    [
      donatedSharedBatchId,
      {
        id: donatedSharedBatchId,
        inventory_item_id: sharedItemId,
        batch_no: "DON-BATCH-WATER",
        quantity_available: 5,
        source_type: "DONATED",
        status: "AVAILABLE",
        expiration_date: "2027-01-01",
        received_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    [
      sharedBatchId,
      {
        id: sharedBatchId,
        inventory_item_id: sharedItemId,
        batch_no: "BATCH-WATER",
        quantity_available: 5,
        source_type: "LGU",
        status: "AVAILABLE",
        expiration_date: "2027-01-01",
        received_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    [
      standardBatchId,
      {
        id: standardBatchId,
        inventory_item_id: standardItemId,
        batch_no: "BATCH-RICE",
        quantity_available: 2,
        source_type: "LGU",
        status: "AVAILABLE",
        expiration_date: "2027-01-01",
        received_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    [
      additionalBatchId,
      {
        id: additionalBatchId,
        inventory_item_id: additionalItemId,
        batch_no: "BATCH-BLANKET",
        quantity_available: 2,
        source_type: "LGU",
        status: "AVAILABLE",
        expiration_date: "2027-01-01",
        received_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
  ]);
  const events = [];
  const insertedItems = [];
  const inventoryTransactions = [];
  const linkedTemplateIds = [];
  const updatedSnapshots = [];
  const distributionTransactionInput = {};
  const stubs = createBaseStubs({
    events,
    stub: {
      ...baseStub,
      status: "ISSUED",
      current_stay_type: "EVAC_CENTER",
    },
  });

  stubs[reliefPackAssignmentServicePath] = {
    resolveAssignedReliefPackTemplatesForHousehold: async (
      householdId,
      disasterEventId,
    ) => {
      assert.equal(householdId, baseStub.household_id);
      assert.equal(disasterEventId, baseStub.disaster_event_id);
      return assignedTemplates;
    },
    getPrimaryAssignedReliefPackTemplate: (templates) => templates[0] || null,
  };

  stubs[reliefPackTemplateRepositoryPath] = {
    getReliefPackTemplateDisasterTypesByTemplateId: async () => [],
  };
  stubs[inventoryItemRepositoryPath] = {
    getInventoryItemByIdForUpdate: async (inventoryItemId) =>
      inventoryItems.get(inventoryItemId) || null,
    updateInventoryItemStockSnapshot: async (inventoryItemId, snapshot) => {
      updatedSnapshots.push({ inventoryItemId, snapshot });
    },
  };
  stubs[distributionTransactionRepositoryPath] = {
    ...stubs[distributionTransactionRepositoryPath],
    getReliefPackTemplateByIdForUpdate: async (templateId) =>
      assignedTemplates.find((template) => template.id === templateId) || null,
    getReliefPackTemplateItemsByTemplateIdForUpdate: async (templateId) =>
      templateItemsById.get(templateId) || [],
    getAvailableInventoryBatchesByItemIdForUpdate: async (inventoryItemId) =>
      [...batches.values()]
        .filter(
          (batch) =>
            batch.inventory_item_id === inventoryItemId &&
            batch.quantity_available > 0,
        )
        .map((batch) => ({
          ...batch,
          item_code: inventoryItems.get(inventoryItemId)?.item_code,
          item_name: inventoryItems.get(inventoryItemId)?.item_name,
          unit_of_measure: inventoryItems.get(inventoryItemId)?.unit_of_measure,
          reorder_level: inventoryItems.get(inventoryItemId)?.reorder_level,
        })),
    getInventoryBatchByIdForUpdate: async (batchId) => {
      const batch = batches.get(batchId);
      const inventoryItem = batch
        ? inventoryItems.get(batch.inventory_item_id)
        : null;
      return batch
        ? {
            ...batch,
            item_code: inventoryItem?.item_code,
            item_name: inventoryItem?.item_name,
            unit_of_measure: inventoryItem?.unit_of_measure,
            reorder_level: inventoryItem?.reorder_level,
          }
        : null;
    },
    getDistributionReceiptSequence: async () => "RCPT-2026-000002",
    insertDistributionTransaction: async (transactionData) => {
      Object.assign(distributionTransactionInput, transactionData);
      return {
        id: "distribution-1",
        distribution_date: "2026-08-29T00:00:00.000Z",
        ...transactionData,
      };
    },
    insertDistributionTransactionReliefPackTemplates: async (
      distributionTransactionId,
      templateSnapshots,
    ) => {
      assert.equal(distributionTransactionId, "distribution-1");
      linkedTemplateIds.push(...templateSnapshots.map((template) => template.id));
      return [];
    },
    insertDistributionTransactionItem: async (itemData) => {
      const insertedItem = {
        id: `distribution-item-${insertedItems.length + 1}`,
        ...itemData,
      };
      insertedItems.push(insertedItem);
      return insertedItem;
    },
    updateInventoryBatchQuantityAndStatus: async (
      batchId,
      quantityAvailable,
      status,
    ) => {
      const batch = batches.get(batchId);
      batch.quantity_available = quantityAvailable;
      batch.status = status;
      return { ...batch };
    },
    insertInventoryTransaction: async (transactionData) => {
      inventoryTransactions.push(transactionData);
      return transactionData;
    },
    updateStubAsClaimed: async () => ({
      ...baseStub,
      status: "CLAIMED",
      claimed_at: "2026-08-29T00:00:00.000Z",
    }),
  };

  const dbClient = {
    query: async (_sql, values = []) => {
      if (Array.isArray(values[0])) {
        return {
          rows: [...inventoryItems.keys()].map((inventoryItemId) => ({
            inventory_item_id: inventoryItemId,
            total_quantity: [...batches.values()]
              .filter((batch) => batch.inventory_item_id === inventoryItemId)
              .reduce(
                (total, batch) => total + Number(batch.quantity_available || 0),
                0,
              ),
          })),
        };
      }

      const inventoryItemId = values[0];
      return {
        rows: [
          {
            total_quantity: [...batches.values()]
              .filter((batch) => batch.inventory_item_id === inventoryItemId)
              .reduce(
                (total, batch) => total + Number(batch.quantity_available || 0),
                0,
              ),
          },
        ],
      };
    },
  };

  const response = await withStubbedDistributionService(
    stubs,
    async ({ createDistributionTransaction }) =>
      createDistributionTransaction({
        ...baseRequest,
        dbClient,
        stub_id: baseStub.id,
        relief_pack_template_id: additionalTemplateId,
        items: [],
      }),
  );

  assert.equal(response.relief_pack_template_id, standardTemplateId);
  assert.equal(response.relief_pack_template_name, "Standard Family Pack");
  assert.deepEqual(response.relief_pack_template_names, [
    "Standard Family Pack",
    "Senior Citizen Add-on",
  ]);
  assert.deepEqual(linkedTemplateIds, [standardTemplateId, additionalTemplateId]);
  assert.equal(distributionTransactionInput.relief_pack_template_id, standardTemplateId);
  assert.equal(
    response.items.find((item) => item.inventory_batch_id === donatedSharedBatchId)
      .source_type,
    "DONATED",
  );
  assert.deepEqual(
    insertedItems.map(({ inventory_item_id, quantity_released }) => ({
      inventory_item_id,
      quantity_released,
    })),
    [
      { inventory_item_id: sharedItemId, quantity_released: 5 },
      { inventory_item_id: standardItemId, quantity_released: 1 },
      { inventory_item_id: additionalItemId, quantity_released: 1 },
    ],
  );
  assert.equal(inventoryTransactions.length, 3);
  assert.equal(
    inventoryTransactions.find(
      (transaction) => transaction.inventory_batch_id === sharedBatchId,
    ),
    undefined,
  );
  assert.ok(
    inventoryTransactions.every((transaction) =>
      transaction.remarks.includes(
        "pack: Standard Family Pack, Senior Citizen Add-on",
      ),
    ),
  );
  assert.equal(updatedSnapshots.length, 3);
  assert.equal(batches.get(donatedSharedBatchId).quantity_available, 0);
  assert.equal(batches.get(sharedBatchId).quantity_available, 5);
  assert.equal(batches.get(standardBatchId).quantity_available, 1);
  assert.equal(batches.get(additionalBatchId).quantity_available, 1);
  assert.deepEqual(events, []);
});
