const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const pool = require("../src/config/db");
const notificationRepository = require("../src/modules/notifications/notification.repository");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";

const assertVerifiedTestDatabase = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Notification recipient integration tests require NODE_ENV=test.");
  }

  if (process.env.ALLOW_TEST_DB_MUTATIONS !== "true") {
    throw new Error(
      "Notification recipient integration tests require ALLOW_TEST_DB_MUTATIONS=true.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Notification recipient integration tests require TEST_DATABASE_URL.",
    );
  }

  const connectionUrl = new URL(rawConnectionString);
  const connectionIdentity = [
    connectionUrl.hostname,
    connectionUrl.username,
    process.env.SUPABASE_URL || "",
  ].join(" ");

  if (!connectionIdentity.includes(TEST_PROJECT_REF)) {
    throw new Error(
      "Notification recipient integration tests require the verified TEST Supabase project.",
    );
  }

  if (connectionIdentity.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      "Notification recipient integration tests refuse the production Supabase project.",
    );
  }
};

const createNotificationPayload = (sourceEventKey) => ({
  disaster_event_id: null,
  rule_code: null,
  type: "SYSTEM",
  title: "Notification recipient uniqueness integration fixture",
  message: "This temporary fixture validates idempotent recipient insertion.",
  severity: "INFO",
  reference_type: null,
  reference_id: null,
  source_event_key: sourceEventKey,
  metadata_json: { test: "notification-recipient-uniqueness" },
});

const createFixture = async () => {
  const dbClient = await pool.connect();
  const suffix = crypto.randomUUID();
  const fixture = {
    userId: null,
    notificationIds: [],
    outboxId: null,
    outboxSourceId: null,
  };

  try {
    await dbClient.query("BEGIN");

    const userResult = await dbClient.query(
      `
        INSERT INTO users (
          email,
          first_name,
          last_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, 'Notification', 'Recipient Test', TRUE, NOW(), NOW())
        RETURNING id
      `,
      [`notification-recipient-${suffix}@distync.local`],
    );
    fixture.userId = userResult.rows[0].id;

    for (const label of ["sequential", "concurrent"]) {
      const notification = await notificationRepository.insertNotification(
        createNotificationPayload(
          `TEST_NOTIFICATION_RECIPIENT_UNIQUENESS:${label}:${suffix}`,
        ),
        dbClient,
      );
      assert.ok(notification?.id, `expected ${label} fixture notification`);
      fixture.notificationIds.push(notification.id);
    }

    fixture.outboxSourceId = crypto.randomUUID();
    const outboxEvent =
      await notificationRepository.ensureNotificationOutboxEvent(
        {
          eventType: "SYNC_FAILURE",
          sourceType: "SYNC_TRANSACTION",
          sourceId: fixture.outboxSourceId,
        },
        dbClient,
      );
    assert.ok(outboxEvent?.id, "expected outbox fixture event");
    fixture.outboxId = outboxEvent.id;

    await dbClient.query("COMMIT");
    return fixture;
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

const cleanupFixture = async ({ userId, notificationIds, outboxId }) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    if (outboxId) {
      await dbClient.query("DELETE FROM notification_outbox WHERE id = $1", [
        outboxId,
      ]);
    }
    if (notificationIds.length > 0) {
      await dbClient.query(
        "DELETE FROM notifications WHERE id = ANY($1::uuid[])",
        [notificationIds],
      );
    }
    if (userId) {
      await dbClient.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await dbClient.query("COMMIT");
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

const countRecipients = async (notificationIds, userId) => {
  const result = await pool.query(
    `
      SELECT notification_id, COUNT(*)::integer AS row_count
      FROM notification_recipients
      WHERE notification_id = ANY($1::uuid[])
        AND user_id = $2
      GROUP BY notification_id
      ORDER BY array_position($1::uuid[], notification_id)
    `,
    [notificationIds, userId],
  );

  return result.rows;
};

const assertCanonicalUniquenessState = async () => {
  const canonicalResult = await pool.query(
    `
      SELECT
        c.conname,
        c.convalidated,
        c.condeferrable,
        c.condeferred,
        c.conindid::regclass::text AS backing_index,
        i.relname AS backing_index_name,
        ix.indisunique,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indkey::text AS indkey,
        ix.indnkeyatts,
        ix.indnatts,
        pg_get_constraintdef(c.oid, true) AS definition
      FROM pg_constraint c
      INNER JOIN pg_class i ON i.oid = c.conindid
      INNER JOIN pg_index ix ON ix.indexrelid = i.oid
      WHERE c.conrelid = 'public.notification_recipients'::regclass
        AND c.conname = 'notification_recipients_unique_delivery'
        AND c.contype = 'u'
    `,
  );

  assert.deepEqual(canonicalResult.rows, [
    {
      conname: "notification_recipients_unique_delivery",
      convalidated: true,
      condeferrable: false,
      condeferred: false,
      backing_index: "notification_recipients_unique_delivery",
      backing_index_name: "notification_recipients_unique_delivery",
      indisunique: true,
      indisvalid: true,
      indisready: true,
      indislive: true,
      indkey: "2 3",
      indnkeyatts: 2,
      indnatts: 2,
      definition: "UNIQUE (notification_id, user_id)",
    },
  ]);

  const redundantIndexResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS row_count
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = 'idx_notification_recipients_unique_delivery'
    `,
  );
  assert.equal(redundantIndexResult.rows[0].row_count, 0);
};

test("notification recipients stay idempotent under repeated and concurrent application inserts", async () => {
  assertVerifiedTestDatabase();
  await assertCanonicalUniquenessState();

  const fixture = await createFixture();

  try {
    const [sequentialNotificationId, concurrentNotificationId] =
      fixture.notificationIds;

    const firstInsert = await notificationRepository.insertNotificationRecipients(
      sequentialNotificationId,
      [fixture.userId],
    );
    const repeatedInsert =
      await notificationRepository.insertNotificationRecipients(
        sequentialNotificationId,
        [fixture.userId],
      );

    assert.equal(firstInsert.length, 1);
    assert.equal(repeatedInsert.length, 0);

    const clients = await Promise.all(
      Array.from({ length: 8 }, () => pool.connect()),
    );
    let concurrentResults;

    try {
      concurrentResults = await Promise.allSettled(
        clients.map((dbClient) =>
          notificationRepository.insertNotificationRecipients(
            concurrentNotificationId,
            [fixture.userId],
            dbClient,
          ),
        ),
      );
    } finally {
      clients.forEach((dbClient) => dbClient.release());
    }

    assert.ok(
      concurrentResults.every((result) => result.status === "fulfilled"),
      "ON CONFLICT DO NOTHING must not leak a unique violation to the application",
    );
    assert.equal(
      concurrentResults.reduce(
        (total, result) => total + result.value.length,
        0,
      ),
      1,
    );

    assert.deepEqual(await countRecipients(fixture.notificationIds, fixture.userId), [
      { notification_id: sequentialNotificationId, row_count: 1 },
      { notification_id: concurrentNotificationId, row_count: 1 },
    ]);

    // A retried outbox intent resolves to the same row, and retrying the
    // materialization's actual recipient writer remains a no-op.
    const firstOutboxEvent =
      await notificationRepository.ensureNotificationOutboxEvent({
        eventType: "SYNC_FAILURE",
        sourceType: "SYNC_TRANSACTION",
        sourceId: fixture.outboxSourceId,
      });
    const repeatedOutboxEvent =
      await notificationRepository.ensureNotificationOutboxEvent({
        eventType: "SYNC_FAILURE",
        sourceType: "SYNC_TRANSACTION",
        sourceId: fixture.outboxSourceId,
      });
    assert.equal(repeatedOutboxEvent.id, firstOutboxEvent.id);

    const retryInsert =
      await notificationRepository.insertNotificationRecipients(
        concurrentNotificationId,
        [fixture.userId],
      );
    assert.equal(retryInsert.length, 0);
    assert.deepEqual(await countRecipients(fixture.notificationIds, fixture.userId), [
      { notification_id: sequentialNotificationId, row_count: 1 },
      { notification_id: concurrentNotificationId, row_count: 1 },
    ]);

    assert.equal(
      await notificationRepository.countUnreadNotificationsForUser(
        fixture.userId,
      ),
      2,
    );

    const markedRead = await notificationRepository.markNotificationAsRead(
      sequentialNotificationId,
      fixture.userId,
    );
    assert.ok(markedRead?.read_at);
    assert.equal(
      await notificationRepository.countUnreadNotificationsForUser(
        fixture.userId,
      ),
      1,
    );

    const unreadRows = await notificationRepository.getNotificationsForUser(
      fixture.userId,
      { roleCode: "MAYOR", status: "UNREAD", limit: 10 },
    );
    assert.equal(unreadRows.length, 1);
    assert.equal(unreadRows[0].id, concurrentNotificationId);

    const markedAllRead = await notificationRepository.markAllNotificationsAsRead(
      fixture.userId,
    );
    assert.equal(markedAllRead.length, 1);
    assert.equal(
      await notificationRepository.countUnreadNotificationsForUser(
        fixture.userId,
      ),
      0,
    );
  } finally {
    await cleanupFixture(fixture);
  }
});
