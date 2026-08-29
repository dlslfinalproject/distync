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
      dbClient,
    );
    await inventoryTransactionRepository.getDistributableInventoryBatchesByItemIdsForUpdate(
      ["item-1"],
      dbClient,
    );

    assert.equal(capturedQueries.length, 2);
    capturedQueries.forEach(assertStandardReliefPackInventoryQuery);
    capturedQueries.forEach((query) => {
      assert.match(query, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(query, /loose_donation\.donation_id\s+IS\s+NOT\s+NULL/i);
      assert.match(query, /COALESCE\(loose_di\.remarks, ''\)\s+NOT\s+ILIKE\s+'Relief Pack:%'/i);
      assert.match(query, /CASE\s+WHEN\s+ib\.source_type\s*=\s*'DONATED'\s+THEN\s+0/i);
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
        dbClient,
      );

      assertStandardReliefPackInventoryQuery(capturedQuery);
      assert.match(capturedQuery, /ib\.source_type\s*=\s*'DONATED'/i);
      assert.match(capturedQuery, /COALESCE\(loose_di\.remarks, ''\)\s+NOT\s+ILIKE\s+'Relief Pack:%'/i);
      assert.match(capturedQuery, /CASE\s+WHEN\s+ib\.source_type\s*=\s*'DONATED'\s+THEN\s+0/i);
    },
  );
});

test("donated relief-pack and loose-item allocation queries exclude unusable donated stock", async () => {
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
      capturedQueries.forEach((query) => {
        assert.match(query, /d\.status <> 'CANCELLED'/i);
        assert.match(query, /ib\.source_type\s*=\s*'DONATED'/i);
        assert.match(query, /COALESCE\(ib\.quantity_available, 0\) > 0/i);
        assert.match(query, /ib\.status\s+IN\s*\('AVAILABLE',\s*'LOW_STOCK'\)/i);
        assert.match(
          query,
          /ib\.expiration_date\s+IS\s+NULL\s+OR\s+ib\.expiration_date\s*>\s*\(CURRENT_DATE\s*\+\s*INTERVAL\s*'30 days'\)/i,
        );
      });
    },
  );
});
