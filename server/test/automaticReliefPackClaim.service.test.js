const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve(
  "../src/services/automaticReliefPackClaim.service",
);
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const reliefPackTemplateRepositoryPath = require.resolve(
  "../src/repositories/reliefPackTemplate.repository",
);
const reliefPackAssignmentServicePath = require.resolve(
  "../src/services/reliefPackAssignment.service",
);

const withStubbedAutomaticClaimService = async (stubs, runTest) => {
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

    const automaticClaimService = require(servicePath);
    await runTest(automaticClaimService);
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

test("automatic claims link and consume inventory for standard and additional templates", async () => {
  const standardTemplate = {
    id: "standard-template",
    name: "Standard Pack",
    is_active: true,
    is_additional_pack: false,
    based_on_family_size: false,
  };
  const additionalTemplate = {
    id: "additional-template",
    name: "Pregnant Mother Pack",
    is_active: true,
    is_additional_pack: true,
    based_on_family_size: false,
  };
  const templateItems = new Map([
    [
      standardTemplate.id,
      [
        {
          inventory_item_id: "water-item",
          item_name: "Water",
          quantity_required: 2,
        },
      ],
    ],
    [
      additionalTemplate.id,
      [
        {
          inventory_item_id: "water-item",
          item_name: "Water",
          quantity_required: 1,
        },
        {
          inventory_item_id: "blanket-item",
          item_name: "Blanket",
          quantity_required: 1,
        },
      ],
    ],
  ]);
  const availableBatches = [
    {
      id: "water-donated-batch",
      inventory_item_id: "water-item",
      quantity_available: 3,
      batch_no: "DON-WATER-1",
      item_code: "WATER",
      item_name: "Water",
      unit_of_measure: "piece",
      reorder_level: 1,
      expiration_date: "2099-12-31",
      status: "AVAILABLE",
      source_type: "DONATED",
      donation_id: "donation-1",
      donor_name: "Community Donor",
      donation_item_id: "donation-item-1",
    },
    {
      id: "water-batch",
      inventory_item_id: "water-item",
      quantity_available: 10,
      batch_no: "WATER-1",
      item_code: "WATER",
      item_name: "Water",
      unit_of_measure: "piece",
      reorder_level: 1,
      expiration_date: "2099-12-31",
      status: "AVAILABLE",
      source_type: "LGU",
    },
    {
      id: "blanket-batch",
      inventory_item_id: "blanket-item",
      quantity_available: 5,
      batch_no: "BLANKET-1",
      item_code: "BLANKET",
      item_name: "Blanket",
      unit_of_measure: "piece",
      reorder_level: 1,
      expiration_date: null,
      status: "AVAILABLE",
      source_type: "LGU",
    },
  ];
  const linkedTemplateIds = [];
  const releasedItems = [];
  const inventoryOutflows = [];
  const updatedBatches = [];
  const updatedItemSnapshots = [];
  const stub = {
    id: "stub-1",
    disaster_event_id: "event-1",
    household_id: "household-1",
    current_stay_type: "EVAC_CENTER",
    is_active: true,
    household_size: 3,
    qr_code_value: "qr-1",
  };
  const inventoryItems = [
    {
      id: "water-item",
      packaging: "piece",
      quantity: 1,
      packaging_count: 10,
    },
    {
      id: "blanket-item",
      packaging: "piece",
      quantity: 1,
      packaging_count: 5,
    },
  ];
  const dbClient = {
    query: async (query) => {
      if (String(query).includes("FROM inventory_batches")) {
        return {
          rows: [
            { inventory_item_id: "water-item", total_quantity: 13 },
            { inventory_item_id: "blanket-item", total_quantity: 5 },
          ],
        };
      }

      return { rows: [] };
    },
  };

  await withStubbedAutomaticClaimService(
    {
      [distributionTransactionRepositoryPath]: {
        getLatestAttendanceByHouseholdId: async () => ({
          status: "PRESENT",
          time_out: null,
        }),
        getReliefPackTemplateItemsByTemplateId: async (templateId) =>
          templateItems.get(templateId) || [],
        getPresentUnclaimedStubQueueContext: async () => ({
          queue_position: 1,
          eligible_households_count: 1,
        }),
        getDonatedReliefPackItemsByDisasterEventId: async () => [],
        getAvailableDonatedLooseItemsByDisasterEventId: async () => [
          {
            donation_id: "donation-1",
            donation_item_id: "donation-item-1",
            donor_name: "Community Donor",
            inventory_item_id: "water-item",
            inventory_batch_id: "water-donated-batch",
            quantity_available: 3,
            quantity_received: 3,
            remarks: "Per Family Allocation: 3",
            batch_no: "DON-WATER-1",
            item_code: "WATER",
            item_name: "Water",
            unit_of_measure: "piece",
            reorder_level: 1,
            status: "AVAILABLE",
            expiration_date: "2099-12-31",
          },
        ],
        getDistributionReceiptSequence: async () => "RCPT-2026-000001",
        insertDistributionTransaction: async () => ({
          id: "distribution-1",
          distribution_status: "CLAIMED",
          relief_pack_template_id: standardTemplate.id,
        }),
        insertDistributionTransactionReliefPackTemplates: async (
          _distributionTransactionId,
          templateIds,
        ) => {
          linkedTemplateIds.push(...templateIds);
          return templateIds.map((relief_pack_template_id) => ({
            distribution_transaction_id: "distribution-1",
            relief_pack_template_id,
          }));
        },
        insertDistributionTransactionItem: async (item) => {
          const insertedItem = {
            id: `distribution-item-${releasedItems.length + 1}`,
            ...item,
          };
          releasedItems.push(insertedItem);
          return insertedItem;
        },
        insertInventoryTransaction: async (transaction) => {
          inventoryOutflows.push(transaction);
          return transaction;
        },
        updateInventoryBatchQuantityAndStatus: async (
          batchId,
          quantityAvailable,
          status,
        ) => {
          const batch = availableBatches.find((item) => item.id === batchId);
          const updatedBatch = {
            ...batch,
            quantity_available: quantityAvailable,
            status,
          };
          updatedBatches.push(updatedBatch);
          return updatedBatch;
        },
        updateDonationStatusesByIds: async () => {},
        updateStubAsClaimed: async () => ({
          ...stub,
          status: "CLAIMED",
        }),
      },
      [inventoryTransactionRepositoryPath]: {
        getDistributableInventoryBatchesByItemIdsForUpdate: async () =>
          availableBatches,
        insertInventoryTransaction: async (transaction) => {
          inventoryOutflows.push(transaction);
          return transaction;
        },
      },
      [inventoryItemRepositoryPath]: {
        getInventoryItemsByIdsForUpdate: async () => inventoryItems,
        updateInventoryItemStockSnapshot: async (_id, snapshot) => {
          updatedItemSnapshots.push(snapshot);
        },
      },
      [reliefPackTemplateRepositoryPath]: {
        getReliefPackTemplateItemsByTemplateId: async (templateId) =>
          templateItems.get(templateId) || [],
      },
        [reliefPackAssignmentServicePath]: {
        resolveAssignedReliefPackTemplatesForHousehold: async () => [
          standardTemplate,
          additionalTemplate,
        ],
        getPrimaryAssignedReliefPackTemplate: (templates) => templates[0],
      },
    },
    async ({ recordAutomaticReliefPackClaim }) => {
      const result = await recordAutomaticReliefPackClaim({
        client: dbClient,
        stub,
        claimedByName: "Family Head",
        verifiedBy: "user-1",
        receivedAt: "2026-08-28T08:00:00.000Z",
      });

      assert.deepEqual(linkedTemplateIds, [
        standardTemplate.id,
        additionalTemplate.id,
      ]);
      assert.deepEqual(
        releasedItems.map((item) => [item.inventory_item_id, item.quantity_released]),
        [
          ["water-item", 3],
          ["blanket-item", 1],
        ],
      );
      assert.deepEqual(
        inventoryOutflows.map((transaction) => [
          transaction.inventory_batch_id,
          transaction.quantity,
        ]),
        [
          ["water-donated-batch", 3],
          ["blanket-batch", 1],
        ],
      );
      assert.equal(result.assignedReliefPackTemplates.length, 2);
      assert.deepEqual(result.donatedLooseItems, []);
      assert.equal(
        result.releasedItems.find((item) => item.inventory_item_id === "water-item")
          .source_relief_type,
        "MIXED_RELIEF_PACK",
      );
      assert.equal(
        result.releasedItems.find((item) => item.inventory_item_id === "water-item")
          .source_type,
        "DONATED",
      );
      assert.equal(
        result.releasedItems.find((item) => item.inventory_item_id === "blanket-item")
          .source_relief_type,
        "ADDITIONAL_RELIEF_PACK",
      );
      assert.equal(
        updatedBatches.find((batch) => batch.id === "water-donated-batch")
          .quantity_available,
        0,
      );
      assert.equal(
        updatedBatches.find((batch) => batch.id === "water-batch"),
        undefined,
      );
      assert.equal(updatedBatches.find((batch) => batch.id === "blanket-batch").quantity_available, 4);
      assert.equal(updatedItemSnapshots.length, 2);
    },
  );
});
