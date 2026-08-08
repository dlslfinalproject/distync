const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve("../src/repositories/sync.repository");
const dbPath = require.resolve("../src/config/db");

const withStubbedPool = async (poolStub, runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[repositoryPath];

  try {
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: poolStub,
    };

    const repository = require(repositoryPath);
    await runTest(repository);
  } finally {
    delete require.cache[repositoryPath];

    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }
  }
};

test("recordConflictAndUpdateSyncTransaction inserts conflict and updates sync status in one transaction", async () => {
  const statements = [];
  const fakeClient = {
    query: async (query) => {
      statements.push(query);

      if (/INSERT INTO sync_conflicts/i.test(query)) {
        return {
          rows: [
            {
              id: "conflict-1",
            },
          ],
        };
      }

      if (/UPDATE sync_transactions/i.test(query)) {
        return {
          rows: [
            {
              id: "sync-1",
              sync_status: "CONFLICT",
            },
          ],
        };
      }

      return { rows: [] };
    },
    release: () => {
      statements.push("RELEASE");
    },
  };

  await withStubbedPool(
    {
      connect: async () => fakeClient,
      query: async () => {
        throw new Error("pool.query should not be used");
      },
      on: () => {},
    },
    async ({ recordConflictAndUpdateSyncTransaction }) => {
      const result = await recordConflictAndUpdateSyncTransaction({
        syncTransactionId: "sync-1",
        transactionPayload: {
          sync_status: "CONFLICT",
          error_message: "Duplicate offline action was ignored",
        },
        conflictPayload: {
          sync_transaction_id: "sync-1",
          entity_type: "HOUSEHOLD",
          conflict_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
          local_payload_json: { local: true },
          server_payload_json: { server: true },
          resolution_strategy: "FIRST_ACCEPTED",
          status: "RESOLVED",
        },
      });

      assert.deepEqual(result, {
        conflictRecord: {
          id: "conflict-1",
        },
        syncTransaction: {
          id: "sync-1",
          sync_status: "CONFLICT",
        },
      });
      assert.match(statements[0], /^BEGIN$/);
      assert.match(statements[1], /INSERT INTO sync_conflicts/i);
      assert.match(statements[2], /UPDATE sync_transactions/i);
      assert.match(statements[3], /^COMMIT$/);
      assert.match(statements[4], /^RELEASE$/);
    },
  );
});

test("recordConflictAndUpdateSyncTransaction rolls back when conflict insert fails", async () => {
  const statements = [];
  const fakeClient = {
    query: async (query) => {
      statements.push(query);

      if (/INSERT INTO sync_conflicts/i.test(query)) {
        throw new Error("constraint violation");
      }

      return { rows: [] };
    },
    release: () => {
      statements.push("RELEASE");
    },
  };

  await withStubbedPool(
    {
      connect: async () => fakeClient,
      query: async () => {
        throw new Error("pool.query should not be used");
      },
      on: () => {},
    },
    async ({ recordConflictAndUpdateSyncTransaction }) => {
      await assert.rejects(
        () =>
          recordConflictAndUpdateSyncTransaction({
            syncTransactionId: "sync-1",
            transactionPayload: {
              sync_status: "CONFLICT",
            },
            conflictPayload: {
              sync_transaction_id: "sync-1",
              entity_type: "HOUSEHOLD",
              conflict_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
              resolution_strategy: "FIRST_ACCEPTED",
            },
          }),
        /constraint violation/,
      );

      assert.match(statements[0], /^BEGIN$/);
      assert.match(statements[1], /INSERT INTO sync_conflicts/i);
      assert.match(statements[2], /^ROLLBACK$/);
      assert.match(statements[3], /^RELEASE$/);
      assert.equal(
        statements.some((statement) => /UPDATE sync_transactions/i.test(statement)),
        false,
      );
    },
  );
});
