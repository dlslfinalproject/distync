const test = require("node:test");
const assert = require("node:assert/strict");

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
    assert.equal(queries[0].params[8], JSON.stringify({ summary: { eventCount: 1 } }));
  } finally {
    restore();
  }
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
