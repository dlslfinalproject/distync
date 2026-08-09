const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryPath = require.resolve("../src/repositories/sync.repository");
const dbPath = require.resolve("../src/config/db");
const notificationRepositoryPath = require.resolve(
  "../src/modules/notifications/notification.repository",
);

const withStubbedPool = async (poolStub, runTest) => {
  const originalRepository = require.cache[repositoryPath];
  const originalDb = require.cache[dbPath];
  const originalNotificationRepository = require.cache[notificationRepositoryPath];

  delete require.cache[repositoryPath];
  delete require.cache[notificationRepositoryPath];

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
    delete require.cache[notificationRepositoryPath];

    if (originalRepository) {
      require.cache[repositoryPath] = originalRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }

    if (originalNotificationRepository) {
      require.cache[notificationRepositoryPath] = originalNotificationRepository;
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

      if (/INSERT INTO notification_outbox/i.test(query)) {
        return {
          rows: [
            {
              id: "outbox-conflict-1",
              event_type: "SYNC_CONFLICT",
              source_id: "conflict-1",
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
        notificationOutboxEvent: {
          id: "outbox-conflict-1",
          event_type: "SYNC_CONFLICT",
          source_id: "conflict-1",
        },
      });
      assert.match(statements[0], /^BEGIN$/);
      assert.match(statements[1], /INSERT INTO sync_conflicts/i);
      assert.match(statements[2], /UPDATE sync_transactions/i);
      assert.match(statements[3], /INSERT INTO notification_outbox/i);
      assert.match(statements[4], /^COMMIT$/);
      assert.match(statements[5], /^RELEASE$/);
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

test("M02-03 recordConflictAndUpdateSyncTransaction rolls back when outbox intent insert fails", async () => {
  const statements = [];
  const fakeClient = {
    query: async (query) => {
      statements.push(query);

      if (/INSERT INTO sync_conflicts/i.test(query)) {
        return { rows: [{ id: "conflict-outbox-fail" }] };
      }

      if (/UPDATE sync_transactions/i.test(query)) {
        return { rows: [{ id: "sync-1", sync_status: "CONFLICT" }] };
      }

      if (/INSERT INTO notification_outbox/i.test(query)) {
        throw new Error("outbox unavailable");
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
        /outbox unavailable/,
      );

      assert.match(statements[0], /^BEGIN$/);
      assert.match(statements[1], /INSERT INTO sync_conflicts/i);
      assert.match(statements[2], /UPDATE sync_transactions/i);
      assert.match(statements[3], /INSERT INTO notification_outbox/i);
      assert.match(statements[4], /^ROLLBACK$/);
      assert.match(statements[5], /^RELEASE$/);
    },
  );
});

test("sync repository claims client_sync_id with database locking and same-row failed retry", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(
    path.join(repoRoot, "server/src/repositories/sync.repository.js"),
    "utf8",
  );

  assert.match(source, /client_sync_id/);
  assert.match(source, /sync_transactions_client_sync_id_unique/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /sync_status = 'FAILED'/);
  assert.match(source, /SET\s+sync_status = 'PENDING'/);
  assert.match(source, /REUSE_MISMATCH/);
});

test("H-03 migration and schema persist a nullable unique client_sync_id", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-08_add_sync_transaction_client_sync_id.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS client_sync_id character varying\(80\)/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX IF NOT EXISTS sync_transactions_client_sync_id_unique/);
  assert.match(migrationSql, /WHERE client_sync_id IS NOT NULL/);
  assert.match(schemaSql, /client_sync_id character varying\(80\)/);
  assert.match(schemaSql, /CREATE UNIQUE INDEX sync_transactions_client_sync_id_unique/);
});

test("BRG-SC-04B reviewable conflict repository queries are limited to open manual stock drift", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(
    path.join(repoRoot, "server/src/repositories/sync.repository.js"),
    "utf8",
  );

  assert.match(source, /getReviewableManualInventoryConflicts/);
  assert.match(source, /countOpenReviewableManualInventoryConflicts/);
  assert.match(source, /sc\.status = \$1/);
  assert.match(source, /sc\.resolution_strategy = \$2/);
  assert.match(source, /sc\.conflict_type = \$3/);
  assert.match(source, /INVENTORY_STOCK_STATE_DRIFT/);
  assert.match(source, /COUNT\(DISTINCT sc\.id\)::int AS count/);
  assert.match(source, /st\.user_id <> \$1/);
});

test("BRG-SC-04B generic sync transaction history remains user scoped", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(
    path.join(repoRoot, "server/src/repositories/sync.repository.js"),
    "utf8",
  );

  assert.match(source, /const getSyncTransactionsByUser/);
  assert.match(source, /WHERE \$\{conditions\.join\(" AND "\)\}/);
  assert.match(source, /const conditions = \["user_id = \$1"\]/);
  assert.doesNotMatch(source, /FROM sync_transactions[\s\S]*r\.code = 'MAYOR'/);
});

test("H03F-07/H03F-08/H03F-09 claim decisions protect stale, active, and legacy pending rows", async () => {
  const createClient = (existingRow) => ({
    query: async (query, values) => {
      if (/INSERT INTO sync_transactions/i.test(query)) {
        const error = new Error("duplicate client_sync_id");
        error.code = "23505";
        error.constraint = "sync_transactions_client_sync_id_unique";
        throw error;
      }

      if (/SELECT \*,/i.test(query) && /FOR UPDATE/i.test(query)) {
        assert.equal(values[1], 5);
        return { rows: [existingRow] };
      }

      if (/UPDATE sync_transactions/i.test(query)) {
        return {
          rows: [
            {
              ...existingRow,
              error_message: null,
              updated_at: "2026-08-08T02:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const basePayload = {
    client_sync_id: "h03f-pending",
    device_id: "device-1",
    user_id: "user-1",
    entity_type: "HOUSEHOLD",
    entity_local_id: "local-1",
    entity_server_id: null,
    operation_type: "CREATE",
    payload_json: { action_key: "HOUSEHOLD_REGISTER", payload: {} },
    client_timestamp: "2026-08-08T01:00:00.000Z",
    sync_status: "PENDING",
  };

  const baseExisting = {
    id: "sync-pending",
    ...basePayload,
    sync_status: "PENDING",
  };

  let staleV2;
  await withStubbedPool(
    { on: () => {} },
    async ({ claimSyncTransaction }) => {
      staleV2 = await claimSyncTransaction(basePayload, createClient({
        ...baseExisting,
        is_stale_pending: true,
        processing_protocol_version: 2,
      }));
    },
  );

  assert.equal(staleV2.decision, "CLAIMED_STALE_RETRY");

  let activeV2;
  await withStubbedPool(
    { on: () => {} },
    async ({ claimSyncTransaction }) => {
      activeV2 = await claimSyncTransaction(basePayload, createClient({
        ...baseExisting,
        is_stale_pending: false,
        processing_protocol_version: 2,
      }));
    },
  );

  assert.equal(activeV2.decision, "IN_PROGRESS");

  let legacyStale;
  await withStubbedPool(
    { on: () => {} },
    async ({ claimSyncTransaction }) => {
      legacyStale = await claimSyncTransaction(basePayload, createClient({
        ...baseExisting,
        is_stale_pending: true,
        processing_protocol_version: null,
      }));
    },
  );

  assert.equal(legacyStale.decision, "LEGACY_STALE_PENDING");
});

test("H03F-10/H03F-11/H03F-12 protocol-v2 schema, insert, and terminal replay identity are preserved", async () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const recoveryMigrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-08_add_sync_recovery_protocol_version.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(recoveryMigrationSql, /ADD COLUMN IF NOT EXISTS processing_protocol_version smallint/);
  assert.match(recoveryMigrationSql, /sync_transactions_pending_protocol_updated_at_idx/);
  assert.match(schemaSql, /processing_protocol_version smallint/);
  assert.match(schemaSql, /sync_transactions_pending_protocol_updated_at_idx/);

  const insertedValues = [];
  const dbClient = {
    query: async (query, values) => {
      if (/INSERT INTO sync_transactions/i.test(query)) {
        insertedValues.push(values);
        return {
          rows: [
            {
              id: "sync-protocol",
              client_sync_id: values[0],
              processing_protocol_version: values[1],
              sync_status: values[11],
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  await withStubbedPool(
    { on: () => {} },
    async ({ insertSyncTransaction }) => {
      const inserted = await insertSyncTransaction(
        {
          client_sync_id: "h03f-11-runtime-v2",
          entity_type: "HOUSEHOLD",
          operation_type: "CREATE",
          payload_json: {},
          client_timestamp: "2026-08-08T01:00:00.000Z",
          sync_status: "PENDING",
        },
        dbClient,
      );

      assert.equal(inserted.processing_protocol_version, 2);
    },
  );

  assert.equal(insertedValues[0][1], 2);

  let terminalReplay;
  await withStubbedPool(
    { on: () => {} },
    async ({ claimSyncTransaction }) => {
      terminalReplay = await claimSyncTransaction(
        {
          client_sync_id: "h03f-12-terminal",
          user_id: "user-1",
          device_id: "device-1",
          entity_type: "HOUSEHOLD",
          entity_local_id: "local-1",
          operation_type: "CREATE",
          payload_json: {},
          client_timestamp: "2026-08-08T01:00:00.000Z",
          sync_status: "PENDING",
        },
        {
          query: async (query) => {
            if (/INSERT INTO sync_transactions/i.test(query)) {
              const error = new Error("duplicate");
              error.code = "23505";
              error.constraint = "sync_transactions_client_sync_id_unique";
              throw error;
            }

            if (/FOR UPDATE/i.test(query)) {
              return {
                rows: [
                  {
                    id: "sync-terminal",
                    client_sync_id: "h03f-12-terminal",
                    user_id: "user-1",
                    device_id: "device-1",
                    entity_type: "HOUSEHOLD",
                    entity_local_id: "local-1",
                    entity_server_id: null,
                    operation_type: "CREATE",
                    payload_json: {},
                    client_timestamp: "2026-08-08T01:00:00.000Z",
                    sync_status: "SYNCED",
                    processing_protocol_version: 2,
                  },
                ],
              };
            }

            return { rows: [] };
          },
        },
      );
    },
  );

  assert.equal(terminalReplay.decision, "REPLAY_TERMINAL");
  assert.equal(terminalReplay.transaction.id, "sync-terminal");
  assert.equal(terminalReplay.transaction.processing_protocol_version, 2);
});

test("H03F-13/H03F-14 failed retry reuses the same row and updates it under lock", async () => {
  const updateIds = [];
  const payload = {
    client_sync_id: "h03f-failed-retry",
    user_id: "user-1",
    device_id: "device-1",
    entity_type: "HOUSEHOLD",
    entity_local_id: "local-1",
    operation_type: "CREATE",
    payload_json: {},
    client_timestamp: "2026-08-08T01:00:00.000Z",
    sync_status: "PENDING",
  };

  let claim;
  await withStubbedPool(
    { on: () => {} },
    async ({ claimSyncTransaction }) => {
      claim = await claimSyncTransaction(payload, {
        query: async (query, values) => {
          if (/INSERT INTO sync_transactions/i.test(query)) {
            const error = new Error("duplicate");
            error.code = "23505";
            error.constraint = "sync_transactions_client_sync_id_unique";
            throw error;
          }

          if (/FOR UPDATE/i.test(query)) {
            return {
              rows: [
                {
                  id: "sync-failed-same-row",
                  ...payload,
                  sync_status: "FAILED",
                  processing_protocol_version: 2,
                },
              ],
            };
          }

          if (/UPDATE sync_transactions/i.test(query)) {
            updateIds.push(values[0]);
            return {
              rows: [
                {
                  id: values[0],
                  sync_status: "PENDING",
                  processing_protocol_version: 2,
                },
              ],
            };
          }

          return { rows: [] };
        },
      });
    },
  );

  assert.equal(claim.decision, "CLAIMED_RETRY");
  assert.equal(claim.transaction.id, "sync-failed-same-row");
  assert.deepEqual(updateIds, ["sync-failed-same-row"]);
});

test("H03F-15 withSyncProcessingTransaction rolls back and releases on SQL error", async () => {
  const statements = [];
  const fakeClient = {
    query: async (query) => {
      statements.push(query);

      if (query === "SELECT broken") {
        throw new Error("current transaction is aborted");
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
      on: () => {},
    },
    async ({ withSyncProcessingTransaction }) => {
      await assert.rejects(
        () => withSyncProcessingTransaction((dbClient) => dbClient.query("SELECT broken")),
        /current transaction is aborted/,
      );
    },
  );

  assert.deepEqual(statements, ["BEGIN", "SELECT broken", "ROLLBACK", "RELEASE"]);
});
