const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryPath = require.resolve(
  "../src/modules/notifications/notification.repository",
);
const dbConfigPath = require.resolve("../src/config/db");

const loadRepositoryWithPoolStub = (poolStub) => {
  const originalDbConfig = require.cache[dbConfigPath];
  const originalRepository = require.cache[repositoryPath];

  delete require.cache[repositoryPath];
  require.cache[dbConfigPath] = {
    id: dbConfigPath,
    filename: dbConfigPath,
    loaded: true,
    exports: poolStub,
  };

  const repository = require(repositoryPath);

  return {
    repository,
    restore() {
      delete require.cache[repositoryPath];

      if (originalRepository) {
        require.cache[repositoryPath] = originalRepository;
      } else {
        delete require.cache[repositoryPath];
      }

      if (originalDbConfig) {
        require.cache[dbConfigPath] = originalDbConfig;
      } else {
        delete require.cache[dbConfigPath];
      }
    },
  };
};

test("insertNotification accepts SUMMARY and forwards the payload to SQL insertion", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [{ id: "notification-summary-1" }] };
    },
  });

  try {
    const result = await repository.insertNotification({
      disaster_event_id: null,
      rule_code: "EVACUATION_SUMMARY_REPORT",
      type: "SUMMARY",
      title: "Evacuation summary report",
      message: "A prepared summary is ready for review.",
      severity: "INFO",
      reference_type: "NOTIFICATION_SUMMARY",
      reference_id: null,
      metadata_json: { summary: { eventCount: 1 } },
    });

    assert.deepEqual(result, { id: "notification-summary-1" });
    assert.equal(queries.length, 1);
    assert.equal(queries[0].params[1], "EVACUATION_SUMMARY_REPORT");
    assert.equal(queries[0].params[2], "SUMMARY");
    assert.equal(queries[0].params[8], null);
    assert.equal(queries[0].params[9], JSON.stringify({ summary: { eventCount: 1 } }));
  } finally {
    restore();
  }
});

test("M02 notification insert uses source_event_key for DB-backed materialization deduplication", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [{ id: "notification-source-key" }] };
    },
  });

  try {
    await repository.insertNotification({
      disaster_event_id: null,
      rule_code: "SYNC_CONFLICT",
      type: "SYNC",
      title: "Synchronization conflict detected",
      message: "Conflict detected.",
      severity: "CRITICAL",
      reference_type: "SYNC_CONFLICT",
      reference_id: "conflict-1",
      source_event_key: "SYNC_CONFLICT:conflict-1",
      metadata_json: { conflictId: "conflict-1" },
    });

    assert.match(queries[0].sql, /source_event_key/);
    assert.match(queries[0].sql, /ON CONFLICT \(source_event_key\)/);
    assert.match(queries[0].sql, /WHERE source_event_key IS NOT NULL/);
    assert.equal(queries[0].params[8], "SYNC_CONFLICT:conflict-1");
  } finally {
    restore();
  }
});

test("M02 outbox event insertion is source unique and idempotent", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [{ id: "outbox-1", event_type: params[0], source_id: params[2] }] };
    },
  });

  try {
    const event = await repository.ensureNotificationOutboxEvent({
      eventType: "SYNC_FAILURE",
      sourceType: "SYNC_TRANSACTION",
      sourceId: "sync-1",
    });

    assert.equal(event.id, "outbox-1");
    assert.match(queries[0].sql, /INSERT INTO notification_outbox/);
    assert.match(queries[0].sql, /ON CONFLICT \(event_type, source_type, source_id\)/);
    assert.equal(queries[0].params[0], "SYNC_FAILURE");
    assert.equal(queries[0].params[1], "SYNC_TRANSACTION");
    assert.equal(queries[0].params[2], "sync-1");
  } finally {
    restore();
  }
});

test("M02 pending outbox claim uses SKIP LOCKED and stale PROCESSING recovery", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  });

  try {
    await repository.claimPendingNotificationOutboxEvents(10);

    assert.match(queries[0].sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(queries[0].sql, /status IN \('PENDING', 'FAILED'\)/);
    assert.match(queries[0].sql, /status = 'PROCESSING'/);
    assert.equal(queries[0].params[0], 10);
  } finally {
    restore();
  }
});

test("M02 migration and schema define notification outbox and source-event deduplication", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const migrationSql = fs.readFileSync(
    path.join(
      repoRoot,
      "database/migrations/2026-08-08_add_notification_outbox_for_sync_events.sql",
    ),
    "utf8",
  );
  const schemaSql = fs.readFileSync(
    path.join(repoRoot, "database/schema/distync_schema.sql"),
    "utf8",
  );

  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.notification_outbox/);
  assert.match(migrationSql, /UNIQUE \(event_type, source_type, source_id\)/);
  assert.match(migrationSql, /notifications_source_event_key_unique/);
  assert.match(schemaSql, /CREATE TABLE public\.notification_outbox/);
  assert.match(schemaSql, /source_event_key text/);
  assert.match(schemaSql, /WHERE source_event_key IS NOT NULL/);
});

test("insertNotification rejects unsupported notification types before touching the database", async () => {
  let queryCalled = false;
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async () => {
      queryCalled = true;
      return { rows: [] };
    },
  });

  try {
    await assert.rejects(
      () =>
        repository.insertNotification({
          disaster_event_id: null,
          type: "INVALID_TYPE",
          title: "Invalid notification",
          message: "This should never reach PostgreSQL.",
          severity: "INFO",
          reference_type: null,
          reference_id: null,
        }),
      /Unsupported notification type: INVALID_TYPE/,
    );
    assert.equal(queryCalled, false);
  } finally {
    restore();
  }
});

test("recipient notification listing applies filters before deterministic keyset pagination", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  });

  try {
    await repository.getNotificationsForUser(
      "user-1",
      {
        roleCode: "MAYOR",
        status: "UNREAD",
        category: "INVENTORY_MONITORING",
        priority: "CRITICAL",
        cursor: {
          generatedAt: "2026-08-07T08:00:00.000Z",
          id: "550e8400-e29b-41d4-a716-446655440000",
        },
        limit: 25,
      },
    );

    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /nr\.user_id = \$1/);
    assert.match(queries[0].sql, /nr\.read_at IS NULL/);
    assert.match(queries[0].sql, /p\.category_code = \$3/);
    assert.match(queries[0].sql, /p\.priority = \$4/);
    assert.match(queries[0].sql, /\(n\.generated_at, n\.id\) < \(\$5::timestamptz, \$6::uuid\)/);
    assert.match(queries[0].sql, /ORDER BY n\.generated_at DESC, n\.id DESC/);
    assert.equal(queries[0].params.at(-1), 26);
  } finally {
    restore();
  }
});

test("insertSummaryEvent atomically appends a new event while suppressing retry duplicates", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  });

  try {
    const result = await repository.insertSummaryEvent({
      summaryKey: "MAYOR:EVACUATION_SUMMARY_REPORT:event-1:all:2026-08-05T05:00:00.000Z",
      ruleCode: "EVACUATION_SUMMARY_REPORT",
      roleCode: "MAYOR",
      barangayId: null,
      disasterEventId: "event-1",
      referenceScope: {
        timezone: "Asia/Manila",
      },
      payload: {
        eventId: "HOUSEHOLD:household-1:registered",
        action: "registered",
      },
      aggregateEvents: true,
      windowStartedAt: "2026-08-05T05:00:00.000Z",
      windowEndsAt: "2026-08-05T06:00:00.000Z",
      readyAt: "2026-08-05T06:00:00.000Z",
    });

    assert.equal(result, null);
    assert.equal(queries.length, 1);
    assert.match(queries[0].sql, /ON CONFLICT \(summary_key\) DO UPDATE/);
    assert.match(queries[0].sql, /jsonb_array_elements/);
    assert.match(queries[0].sql, /eventId/);
    assert.equal(
      queries[0].params[0],
      "MAYOR:EVACUATION_SUMMARY_REPORT:event-1:all:2026-08-05T05:00:00.000Z",
    );
  } finally {
    restore();
  }
});

test("email delivery state mutations explicitly maintain updated_at", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql) => {
      queries.push(sql);
      return { rows: [] };
    },
  });

  try {
    await repository.claimNotificationEmailDelivery({
      notificationId: "notification-1", recipientUserId: "user-1", roleCode: "MAYOR",
      maxAttempts: 3, staleAfterSeconds: 900,
    });
    await repository.markNotificationEmailDeliveryResult({ deliveryId: "delivery-1", status: "SENT" });
    await repository.markNotificationEmailDeliverySkipped({ notificationId: "notification-1", recipientUserId: "user-1", roleCode: "MAYOR", reason: "EMAIL_NO_LONGER_ELIGIBLE" });
    await repository.markNotificationEmailDeliveryFailedWithoutAttempt({ notificationId: "notification-1", recipientUserId: "user-1", roleCode: "MAYOR", reason: "EMAIL_RECIPIENT_INVALID" });

    assert.equal(queries.length, 4);
    queries.forEach((sql) => assert.match(sql, /updated_at\s*=\s*NOW\(\)|updated_at\)/i));
  } finally {
    restore();
  }
});

test("retry query covers due retries and stale SENDING claims without retrying inactive users", async () => {
  const queries = [];
  const { repository, restore } = loadRepositoryWithPoolStub({
    query: async (sql) => {
      queries.push(sql);
      return { rows: [] };
    },
  });

  try {
    await repository.getRetryableNotificationEmailDeliveries();
    assert.match(queries[0], /d\.status = 'RETRY_PENDING' AND d\.next_retry_at <= NOW\(\)/);
    assert.match(queries[0], /d\.status = 'SENDING' AND d\.last_attempt_at <= NOW\(\) - \(15 \* INTERVAL '1 minute'\)/);
    assert.doesNotMatch(queries[0], /u\.is_active = TRUE/);
  } finally {
    restore();
  }
});
