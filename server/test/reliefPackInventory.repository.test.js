const test = require("node:test");
const assert = require("node:assert/strict");

const dbPath = require.resolve("../src/config/db");
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const distributionTransactionRepositoryPath = require.resolve(
  "../src/repositories/distributionTransaction.repository",
);

const withStubbedRepositories = async (runTest) => {
  const originalDb = require.cache[dbPath];
  const originalInventoryRepository = require.cache[
    inventoryTransactionRepositoryPath
  ];
  const originalDistributionRepository = require.cache[
    distributionTransactionRepositoryPath
  ];

  delete require.cache[inventoryTransactionRepositoryPath];
  delete require.cache[distributionTransactionRepositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: {},
    };

    const inventoryTransactionRepository = require(
      inventoryTransactionRepositoryPath,
    );
    const distributionTransactionRepository = require(
      distributionTransactionRepositoryPath,
    );

    await runTest({
      inventoryTransactionRepository,
      distributionTransactionRepository,
    });
  } finally {
    delete require.cache[inventoryTransactionRepositoryPath];
    delete require.cache[distributionTransactionRepositoryPath];

    if (originalInventoryRepository) {
      require.cache[inventoryTransactionRepositoryPath] = originalInventoryRepository;
    }

    if (originalDistributionRepository) {
      require.cache[distributionTransactionRepositoryPath] = originalDistributionRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }
  }
};

const assertStandardReliefPackInventoryQuery = (query) => {
  assert.match(query, /ib\.source_type\s*=\s*'LGU'/i);
  assert.match(query, /ib\.status\s+IN\s*\('AVAILABLE',\s*'LOW_STOCK'\)/i);
  assert.match(
    query,
    /ib\.expiration_date\s+IS\s+NULL\s+OR\s+ib\.expiration_date\s*>\s*\(CURRENT_DATE\s*\+\s*INTERVAL\s*'30 days'\)/i,
  );
};

const assertEventAwareLooseDonationQuery = (query) => {
  assert.match(query, /target_event\.status\s*=\s*'ACTIVE'/i);
  assert.match(query, /donation_event\.status\s*=\s*'CLOSED'/i);
  assert.match(query, /next_event\.status\s*=\s*'ACTIVE'/i);
  assert.match(query, /target_event\.created_at/i);
  assert.match(query, /donation_event\.created_at/i);
};

test("automatic relief-pack allocation queries allow loose donations before Malvar LGU stock", async () => {
  await withStubbedRepositories(async ({ inventoryTransactionRepository }) => {
    const capturedQueries = [];
    const dbClient = {
      query: async (query) => {
        capturedQueries.push(query);
        return { rows: [] };
      },
    };

    await inventoryTransactionRepository.getDistributableInventoryBatchesByItemIdForUpdate(
      "item-1",
      "event-1",
      dbClient,
    );
    await inventoryTransactionRepository.getDistributableInventoryBatchesByItemIdsForUpdate(
      ["item-1"],
      "event-1",
      dbClient,
    );

    assert.equal(capturedQueries.length, 2);
    capturedQueries.forEach(assertStandardReliefPackInventoryQuery);
    capturedQueries.forEach((query) => {
      assert.match(query, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(query, /loose_donation\.donation_id\s+IS\s+NOT\s+NULL/i);
      assert.match(query, /COALESCE\(loose_di\.remarks, ''\)\s+NOT\s+ILIKE\s+'Relief Pack:%'/i);
      assert.match(query, /CASE\s+WHEN\s+ib\.source_type\s*=\s*'DONATED'\s+THEN\s+0/i);
      assertEventAwareLooseDonationQuery(query);
    });
  });
});

test("manual template relief-pack allocation queries allow loose donations before Malvar LGU stock", async () => {
  await withStubbedRepositories(
    async ({ distributionTransactionRepository }) => {
      let capturedQuery = "";
      const dbClient = {
        query: async (query) => {
          capturedQuery = query;
          return { rows: [] };
        },
      };

      await distributionTransactionRepository.getAvailableInventoryBatchesByItemIdForUpdate(
        "item-1",
        "event-1",
        dbClient,
      );

      assertStandardReliefPackInventoryQuery(capturedQuery);
      assert.match(capturedQuery, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(capturedQuery, /COALESCE\(loose_di\.remarks, ''\)\s+NOT\s+ILIKE\s+'Relief Pack:%'/i);
      assert.match(capturedQuery, /CASE\s+WHEN\s+ib\.source_type\s*=\s*'DONATED'\s+THEN\s+0/i);
      assertEventAwareLooseDonationQuery(capturedQuery);
    },
  );
});

test("donated relief-pack queries keep every component so incomplete packs cannot look complete", async () => {
  await withStubbedRepositories(
    async ({ distributionTransactionRepository }) => {
      const capturedQueries = [];
      const dbClient = {
        query: async (query) => {
          capturedQueries.push(query);
          return { rows: [] };
        },
      };

      await distributionTransactionRepository.getDonatedReliefPackItemsByDisasterEventId(
        "event-1",
        dbClient,
      );
      await distributionTransactionRepository.getAvailableDonatedLooseItemsByDisasterEventId(
        "event-1",
        dbClient,
      );

      assert.equal(capturedQueries.length, 2);
      const donatedReliefPackQuery = capturedQueries[0];
      assert.match(donatedReliefPackQuery, /d\.status <> 'CANCELLED'/i);
      assert.match(donatedReliefPackQuery, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(
        donatedReliefPackQuery,
        /COALESCE\(di\.remarks, ''\)\s+ILIKE\s+'Relief Pack:%'/i,
      );
      assert.doesNotMatch(donatedReliefPackQuery, /COALESCE\(ib\.quantity_available, 0\) > 0/i);
      assert.doesNotMatch(
        donatedReliefPackQuery,
        /ib\.status\s+IN\s*\('AVAILABLE',\s*'LOW_STOCK'\)/i,
      );
      assert.doesNotMatch(
        donatedReliefPackQuery,
        /ib\.expiration_date\s+IS\s+NULL\s+OR\s+ib\.expiration_date\s*>\s*\(CURRENT_DATE\s*\+\s*INTERVAL\s*'30 days'\)/i,
      );

      const donatedLooseItemQuery = capturedQueries[1];
      assert.match(donatedLooseItemQuery, /d\.status <> 'CANCELLED'/i);
      assert.match(donatedLooseItemQuery, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(donatedLooseItemQuery, /COALESCE\(ib\.quantity_available, 0\) > 0/i);
      assert.match(donatedLooseItemQuery, /ib\.status\s+IN\s*\('AVAILABLE',\s*'LOW_STOCK'\)/i);
      assert.match(
        donatedLooseItemQuery,
        /ib\.expiration_date\s+IS\s+NULL\s+OR\s+ib\.expiration_date\s*>\s*\(CURRENT_DATE\s*\+\s*INTERVAL\s*'30 days'\)/i,
      );

      assertEventAwareLooseDonationQuery(donatedLooseItemQuery);
    },
  );
});

test("donated relief-pack claim queue is scoped to the disaster event, not a barangay", async () => {
  await withStubbedRepositories(
    async ({ distributionTransactionRepository }) => {
      let capturedQuery = "";
      const dbClient = {
        query: async (query) => {
          capturedQuery = query;
          return { rows: [{ queue_position: 2, eligible_households_count: 4 }] };
        },
      };

      const queueContext =
        await distributionTransactionRepository.getPresentUnclaimedStubQueueContext(
          "stub-1",
          dbClient,
        );

      assert.deepEqual(queueContext, {
        queue_position: 2,
        eligible_households_count: 4,
      });
      assert.match(capturedQuery, /target\.disaster_event_id\s*=\s*s\.disaster_event_id/i);
      assert.doesNotMatch(
        capturedQuery,
        /h\.barangay_id\s+IS\s+NOT\s+DISTINCT\s+FROM\s+target\.barangay_id/i,
      );
    },
  );
});
