const pool = require("../../config/db");
const {
  assertValidNotificationType,
} = require("./notification.constants");

const getNotificationRuleByCode = async (code, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT id, code, name, trigger_type, target_role_code, is_active
      FROM notification_rules
      WHERE code = $1
      LIMIT 1
    `,
    [code],
  );

  return result.rows[0] || null;
};

const getNotificationPolicyRowsByRoleCode = async (
  roleCode,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        nr.id,
        nr.code,
        nr.name,
        nr.trigger_type,
        nr.target_role_code,
        nr.is_active,
        nr.created_at,
        p.role_code,
        p.category_code,
        p.category_label,
        p.priority,
        p.in_app_policy,
        p.email_policy,
        p.delivery_mode,
        p.user_configurability,
        p.is_active AS policy_is_active
      FROM notification_rule_role_policies p
      INNER JOIN notification_rules nr ON nr.code = p.rule_code
      WHERE p.role_code = $1
        AND COALESCE(p.is_active, TRUE) = TRUE
        AND COALESCE(nr.is_active, TRUE) = TRUE
      ORDER BY p.category_label ASC, nr.name ASC
    `,
    [roleCode],
  );

  return result.rows;
};

const getNotificationPolicyRow = async (
  ruleCode,
  roleCode,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        nr.id,
        nr.code,
        nr.name,
        nr.trigger_type,
        nr.target_role_code,
        nr.is_active,
        nr.created_at,
        p.role_code,
        p.category_code,
        p.category_label,
        p.priority,
        p.in_app_policy,
        p.email_policy,
        p.delivery_mode,
        p.user_configurability,
        p.is_active AS policy_is_active
      FROM notification_rule_role_policies p
      INNER JOIN notification_rules nr ON nr.code = p.rule_code
      WHERE p.rule_code = $1
        AND p.role_code = $2
        AND COALESCE(p.is_active, TRUE) = TRUE
        AND COALESCE(nr.is_active, TRUE) = TRUE
      LIMIT 1
    `,
    [ruleCode, roleCode],
  );

  return result.rows[0] || null;
};

const getNotificationRulesByTargetRoleCode = async (roleCode, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        id,
        code,
        name,
        trigger_type,
        target_role_code,
        is_active,
        created_at
      FROM notification_rules
      WHERE target_role_code = $1
      ORDER BY is_active DESC, name ASC
    `,
    [roleCode],
  );

  return result.rows;
};

const upsertNotificationRule = async (payload, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_rules (
        code,
        name,
        trigger_type,
        target_role_code,
        is_active,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (code)
      DO UPDATE SET
        name = EXCLUDED.name,
        trigger_type = EXCLUDED.trigger_type,
        target_role_code = EXCLUDED.target_role_code,
        is_active = EXCLUDED.is_active
      WHERE
        notification_rules.name IS DISTINCT FROM EXCLUDED.name
        OR notification_rules.trigger_type IS DISTINCT FROM EXCLUDED.trigger_type
        OR notification_rules.target_role_code IS DISTINCT FROM EXCLUDED.target_role_code
        OR notification_rules.is_active IS DISTINCT FROM EXCLUDED.is_active
      RETURNING
        id,
        code,
        name,
        trigger_type,
        target_role_code,
        is_active,
        (xmax = 0) AS inserted
    `,
    [
      payload.code,
      payload.name,
      payload.trigger_type,
      payload.target_role_code,
      payload.is_active ?? true,
    ],
  );

  return result.rows[0] || null;
};

const upsertNotificationRuleRolePolicy = async (payload, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_rule_role_policies (
        rule_code,
        role_code,
        category_code,
        category_label,
        priority,
        in_app_policy,
        email_policy,
        delivery_mode,
        user_configurability,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (rule_code, role_code)
      DO UPDATE SET
        category_code = EXCLUDED.category_code,
        category_label = EXCLUDED.category_label,
        priority = EXCLUDED.priority,
        in_app_policy = EXCLUDED.in_app_policy,
        email_policy = EXCLUDED.email_policy,
        delivery_mode = EXCLUDED.delivery_mode,
        user_configurability = EXCLUDED.user_configurability,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      WHERE
        notification_rule_role_policies.category_code IS DISTINCT FROM EXCLUDED.category_code
        OR notification_rule_role_policies.category_label IS DISTINCT FROM EXCLUDED.category_label
        OR notification_rule_role_policies.priority IS DISTINCT FROM EXCLUDED.priority
        OR notification_rule_role_policies.in_app_policy IS DISTINCT FROM EXCLUDED.in_app_policy
        OR notification_rule_role_policies.email_policy IS DISTINCT FROM EXCLUDED.email_policy
        OR notification_rule_role_policies.delivery_mode IS DISTINCT FROM EXCLUDED.delivery_mode
        OR notification_rule_role_policies.user_configurability IS DISTINCT FROM EXCLUDED.user_configurability
        OR notification_rule_role_policies.is_active IS DISTINCT FROM EXCLUDED.is_active
      RETURNING *, (xmax = 0) AS inserted
    `,
    [
      payload.ruleCode,
      payload.roleCode,
      payload.categoryCode,
      payload.categoryLabel,
      payload.priority,
      payload.inAppPolicy,
      payload.emailPolicy,
      payload.deliveryMode,
      payload.userConfigurability,
      payload.isActive ?? true,
    ],
  );

  return result.rows[0] || null;
};

const getRecipientUserIdsByRoleCode = async (roleCode, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.is_active = TRUE
        AND r.code = $1
      ORDER BY u.id ASC
    `,
    [roleCode],
  );

  return result.rows.map((row) => row.id);
};

const getRecipientUserIdsByRoleCodeAndBarangayIds = async (
  roleCode,
  barangayIds,
  dbClient = pool,
) => {
  if (!Array.isArray(barangayIds) || barangayIds.length === 0) {
    return [];
  }

  const result = await dbClient.query(
    `
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE u.is_active = TRUE
        AND r.code = $1
        AND u.default_barangay_id = ANY($2::UUID[])
      ORDER BY u.id ASC
    `,
    [roleCode, barangayIds],
  );

  return result.rows.map((row) => row.id);
};

const getUserNotificationPreferencesByRole = async (
  userIds,
  roleCode,
  dbClient = pool,
) => {
  if (!Array.isArray(userIds) || userIds.length === 0 || !roleCode) {
    return [];
  }

  const result = await dbClient.query(
    `
      SELECT
        u.id AS user_id,
        u.email,
        urs.notification_rule_preferences_json
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      LEFT JOIN user_role_settings urs
        ON urs.user_id = u.id
       AND urs.role_code = r.code
      WHERE u.is_active = TRUE
        AND u.id = ANY($1::UUID[])
        AND r.code = $2
      ORDER BY u.id ASC
    `,
    [userIds, roleCode],
  );

  return result.rows;
};

const insertSummaryEvent = async (payload, dbClient = pool) => {
  if (!payload.aggregateEvents) {
    const result = await dbClient.query(
      `
        INSERT INTO notification_summary_events (
          summary_key, rule_code, role_code, barangay_id, disaster_event_id,
          reference_scope_json, payload_json, window_started_at, window_ends_at,
          ready_at, processed_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NULL, NOW(), NOW())
        ON CONFLICT (summary_key) DO NOTHING
        RETURNING *
      `,
      [
        payload.summaryKey, payload.ruleCode, payload.roleCode,
        payload.barangayId || null, payload.disasterEventId || null,
        JSON.stringify(payload.referenceScope || {}), JSON.stringify(payload.payload || {}),
        payload.windowStartedAt, payload.windowEndsAt, payload.readyAt,
      ],
    );
    return result.rows[0] || null;
  }

  const result = await dbClient.query(
    `
      INSERT INTO notification_summary_events (
        summary_key,
        rule_code,
        role_code,
        barangay_id,
        disaster_event_id,
        reference_scope_json,
        payload_json,
        window_started_at,
        window_ends_at,
        ready_at,
        processed_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, jsonb_build_object('events', jsonb_build_array($7::jsonb)), $8, $9, $10, NULL, NOW(), NOW())
      ON CONFLICT (summary_key) DO UPDATE
      SET payload_json = CASE
            WHEN jsonb_typeof(notification_summary_events.payload_json -> 'events') = 'array'
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(notification_summary_events.payload_json -> 'events') existing_event
                WHERE existing_event ->> 'eventId' = $7::jsonb ->> 'eventId'
              ) THEN notification_summary_events.payload_json
            WHEN jsonb_typeof(notification_summary_events.payload_json -> 'events') = 'array'
              THEN jsonb_set(
                notification_summary_events.payload_json,
                '{events}',
                (notification_summary_events.payload_json -> 'events') || jsonb_build_array($7::jsonb)
              )
            ELSE jsonb_build_object(
              'events',
              jsonb_build_array(notification_summary_events.payload_json, $7::jsonb)
            )
          END,
          updated_at = NOW()
      RETURNING *
    `,
    [
      payload.summaryKey,
      payload.ruleCode,
      payload.roleCode,
      payload.barangayId || null,
      payload.disasterEventId || null,
      JSON.stringify(payload.referenceScope || {}),
      JSON.stringify(payload.payload || {}),
      payload.windowStartedAt,
      payload.windowEndsAt,
      payload.readyAt,
    ],
  );

  return result.rows[0] || null;
};

const getDueSummaryEvents = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT *
      FROM notification_summary_events
      WHERE processed_at IS NULL
        AND ready_at <= NOW()
      ORDER BY ready_at ASC, created_at ASC
    `,
  );

  return result.rows;
};

const markSummaryEventsProcessed = async (eventIds, dbClient = pool) => {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return [];
  }

  const result = await dbClient.query(
    `
      UPDATE notification_summary_events
      SET processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY($1::UUID[])
      RETURNING id
    `,
    [eventIds],
  );

  return result.rows;
};

const getNotificationDeliveryState = async (stateKey, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT *
      FROM notification_delivery_states
      WHERE state_key = $1
      LIMIT 1
    `,
    [stateKey],
  );

  return result.rows[0] || null;
};

const upsertNotificationDeliveryState = async (payload, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_delivery_states (
        state_key,
        rule_code,
        role_code,
        state_value,
        last_notified_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (state_key)
      DO UPDATE SET
        rule_code = EXCLUDED.rule_code,
        role_code = EXCLUDED.role_code,
        state_value = EXCLUDED.state_value,
        last_notified_at = EXCLUDED.last_notified_at,
        updated_at = NOW()
      RETURNING *
    `,
    [
      payload.stateKey,
      payload.ruleCode,
      payload.roleCode,
      payload.stateValue,
      payload.lastNotifiedAt || null,
    ],
  );

  return result.rows[0] || null;
};

const getRoleCodesByUserId = async (userId, dbClient = pool) => {
  if (!userId) {
    return [];
  }

  const result = await dbClient.query(
    `
      SELECT DISTINCT r.code
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.code ASC
    `,
    [userId],
  );

  return result.rows.map((row) => row.code).filter(Boolean);
};

const getAllNotificationRules = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        id,
        code,
        name,
        trigger_type,
        target_role_code,
        is_active,
        created_at
      FROM notification_rules
      ORDER BY is_active DESC, target_role_code ASC, name ASC
    `,
  );

  return result.rows;
};

const insertNotification = async (payload, dbClient = pool) => {
  assertValidNotificationType(payload.type);

  const result = await dbClient.query(
    `
      INSERT INTO notifications (
        disaster_event_id,
        rule_code,
        type,
        title,
        message,
        severity,
        reference_type,
        reference_id,
        source_event_key,
        generated_at,
        metadata_json,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10::jsonb, NOW())
      ON CONFLICT (source_event_key)
      WHERE source_event_key IS NOT NULL
      DO NOTHING
      RETURNING id
    `,
    [
      payload.disaster_event_id,
      payload.rule_code,
      payload.type,
      payload.title,
      payload.message,
      payload.severity,
      payload.reference_type,
      payload.reference_id,
      payload.source_event_key || null,
      JSON.stringify(payload.metadata_json || {}),
    ],
  );

  return result.rows[0] || null;
};

const findNotificationBySourceEventKey = async (sourceEventKey, dbClient = pool) => {
  if (!sourceEventKey) {
    return null;
  }

  const result = await dbClient.query(
    `
      SELECT id, generated_at
      FROM notifications
      WHERE source_event_key = $1
      LIMIT 1
    `,
    [sourceEventKey],
  );

  return result.rows[0] || null;
};

const insertNotificationRecipients = async (
  notificationId,
  userIds,
  dbClient = pool,
) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = userIds.map((userId, index) => {
    const baseIndex = index * 2;
    values.push(notificationId, userId);
    return `($${baseIndex + 1}, $${baseIndex + 2}, NOW())`;
  });

  const result = await dbClient.query(
    `
      INSERT INTO notification_recipients (
        notification_id,
        user_id,
        created_at
      )
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (notification_id, user_id) DO NOTHING
      RETURNING id, user_id
    `,
    values,
  );

  return result.rows;
};

const findRecentNotificationMatchForUsers = async (
  {
    type,
    title,
    message,
    severity,
    reference_type = null,
    reference_id = null,
  },
  userIds,
  lookbackHours = 24,
  dbClient = pool,
) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return null;
  }

  const result = await dbClient.query(
    `
      SELECT
        n.id,
        n.generated_at
      FROM notifications n
      INNER JOIN notification_recipients nr ON nr.notification_id = n.id
      WHERE nr.user_id = ANY($1::UUID[])
        AND n.type = $2
        AND n.title = $3
        AND n.message = $4
        AND n.severity = $5
        AND COALESCE(n.reference_type, '') = COALESCE($6, '')
        AND COALESCE(n.reference_id::text, '') = COALESCE($7::text, '')
        AND n.generated_at >= NOW() - ($8::integer * INTERVAL '1 hour')
      ORDER BY n.generated_at DESC
      LIMIT 1
    `,
    [
      userIds,
      type,
      title,
      message,
      severity,
      reference_type,
      reference_id,
      lookbackHours,
    ],
  );

  return result.rows[0] || null;
};

const getNotificationsForUser = async (
  userId,
  {
    roleCode,
    status = "ALL",
    category = "ALL",
    priority = "ALL",
    cursor = null,
    limit = 25,
  } = {},
  dbClient = pool,
) => {
  const values = [userId, roleCode];
  const conditions = ["nr.user_id = $1"];

  if (status === "UNREAD") {
    conditions.push("nr.read_at IS NULL");
  }

  if (category !== "ALL") {
    values.push(category);
    conditions.push(`p.category_code = $${values.length}`);
  }

  if (priority !== "ALL") {
    values.push(priority);
    conditions.push(`p.priority = $${values.length}`);
  }

  if (cursor) {
    values.push(cursor.generatedAt, cursor.id);
    conditions.push(
      `(n.generated_at, n.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
    );
  }

  values.push(limit + 1);

  const result = await dbClient.query(
    `
      SELECT
        n.id,
        nr.id AS recipient_id,
        nr.read_at,
        n.disaster_event_id,
        n.rule_code,
        n.type,
        n.title,
        n.message,
        n.severity,
        n.reference_type,
        n.reference_id,
        COALESCE(n.metadata_json, '{}'::jsonb) AS metadata_json,
        n.generated_at,
        n.created_at,
        p.category_code,
        p.category_label,
        p.priority AS policy_priority,
        de.event_code,
        de.title AS disaster_event_title
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      LEFT JOIN notification_rule_role_policies p
        ON p.rule_code = n.rule_code
       AND p.role_code = $2
      LEFT JOIN disaster_events de ON de.id = n.disaster_event_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY n.generated_at DESC, n.id DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows;
};

const countUnreadNotificationsForUser = async (userId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT COUNT(*)::integer AS unread_count
      FROM notification_recipients
      WHERE user_id = $1
        AND read_at IS NULL
    `,
    [userId],
  );

  return result.rows[0]?.unread_count || 0;
};

const markNotificationAsRead = async (notificationId, userId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE notification_recipients
      SET read_at = COALESCE(read_at, NOW())
      WHERE notification_id = $1
        AND user_id = $2
      RETURNING id, read_at
    `,
    [notificationId, userId],
  );

  return result.rows[0] || null;
};

const markAllNotificationsAsRead = async (userId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE notification_recipients
      SET read_at = NOW()
      WHERE user_id = $1
        AND read_at IS NULL
      RETURNING id
    `,
    [userId],
  );

  return result.rows;
};

const getBatchesForExpiryNotificationScan = async (
  thresholdDays,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        ib.id,
        ib.inventory_item_id,
        ib.batch_no,
        ib.quantity_available,
        CAST(COALESCE((
          SELECT SUM(COALESCE(item_stock.quantity_available, 0))
          FROM inventory_batches item_stock
          WHERE item_stock.inventory_item_id = ib.inventory_item_id
        ), 0) AS integer) AS item_total_stock,
        ib.expiration_date,
        ib.status,
        ii.item_name,
        ii.reorder_level
      FROM inventory_batches ib
      INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
      WHERE ib.expiration_date IS NOT NULL
        AND ib.quantity_available > 0
        AND (
          ib.expiration_date <= CURRENT_DATE
          OR (
            ib.expiration_date > CURRENT_DATE
            AND ib.expiration_date <= CURRENT_DATE + ($1::integer * INTERVAL '1 day')
          )
        )
      ORDER BY ib.expiration_date ASC, ii.item_name ASC
    `,
    [thresholdDays],
  );

  return result.rows;
};

const getFailedSyncTransactionsForNotificationScan = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        st.id,
        st.user_id,
        st.entity_type,
        st.operation_type,
        st.sync_status,
        st.error_message,
        st.created_at,
        st.updated_at,
        u.first_name,
        u.last_name
      FROM sync_transactions st
      LEFT JOIN users u ON u.id = st.user_id
      WHERE st.sync_status = 'FAILED'
      ORDER BY st.updated_at DESC, st.created_at DESC
    `,
  );

  return result.rows;
};

const getOpenSyncConflictsForNotificationScan = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        sc.id,
        sc.entity_type,
        sc.entity_server_id,
        sc.conflict_type,
        sc.resolution_action,
        sc.resolution_reason,
        sc.resolved_by,
        sc.resolved_at,
        sc.status,
        sc.created_at,
        st.id AS sync_transaction_id,
        st.user_id,
        st.operation_type,
        u.first_name,
        u.last_name
      FROM sync_conflicts sc
      INNER JOIN sync_transactions st ON st.id = sc.sync_transaction_id
      LEFT JOIN users u ON u.id = st.user_id
      WHERE sc.status = 'OPEN'
      ORDER BY sc.created_at DESC
    `,
  );

  return result.rows;
};

const ensureNotificationOutboxEvent = async (
  { eventType, sourceType, sourceId },
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_outbox (
        event_type,
        source_type,
        source_id,
        status,
        attempt_count,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'PENDING', 0, NOW(), NOW())
      ON CONFLICT (event_type, source_type, source_id)
      DO UPDATE SET updated_at = notification_outbox.updated_at
      RETURNING *
    `,
    [eventType, sourceType, sourceId],
  );

  return result.rows[0] || null;
};

const claimNotificationOutboxEventById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE notification_outbox
      SET status = 'PROCESSING',
          attempt_count = attempt_count + 1,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('PENDING', 'FAILED')
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const claimPendingNotificationOutboxEvents = async (limit = 25, dbClient = pool) => {
  const result = await dbClient.query(
    `
      WITH candidates AS (
        SELECT id
        FROM notification_outbox
        WHERE status IN ('PENDING', 'FAILED')
           OR (status = 'PROCESSING' AND updated_at <= NOW() - (15 * INTERVAL '1 minute'))
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_outbox no
      SET status = 'PROCESSING',
          attempt_count = no.attempt_count + 1,
          last_error = NULL,
          updated_at = NOW()
      FROM candidates
      WHERE no.id = candidates.id
      RETURNING no.*
    `,
    [limit],
  );

  return result.rows;
};

const markNotificationOutboxEventProcessed = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE notification_outbox
      SET status = 'PROCESSED',
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
};

const markNotificationOutboxEventFailed = async (
  { id, errorMessage },
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      UPDATE notification_outbox
      SET status = 'FAILED',
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, String(errorMessage || "Notification processing failed.").slice(0, 500)],
  );

  return result.rows[0] || null;
};

const getSyncTransactionNotificationSourceById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        st.id,
        st.user_id,
        st.entity_type,
        st.operation_type,
        st.sync_status,
        st.error_message,
        st.created_at,
        st.updated_at,
        u.first_name,
        u.last_name
      FROM sync_transactions st
      LEFT JOIN users u ON u.id = st.user_id
      WHERE st.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getSyncConflictNotificationSourceById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        sc.id,
        sc.entity_type,
        sc.entity_server_id,
        sc.conflict_type,
        sc.resolution_action,
        sc.resolution_reason,
        sc.resolved_by,
        sc.resolved_at,
        sc.status,
        sc.created_at,
        st.id AS sync_transaction_id,
        st.user_id,
        st.operation_type,
        u.first_name,
        u.last_name
      FROM sync_conflicts sc
      INNER JOIN sync_transactions st ON st.id = sc.sync_transaction_id
      LEFT JOIN users u ON u.id = st.user_id
      WHERE sc.id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
};

// A single INSERT ... ON CONFLICT claim makes the database the concurrency
// boundary. The provider call deliberately happens after this statement.
const claimNotificationEmailDelivery = async ({
  notificationId, recipientUserId, roleCode, maxAttempts, staleAfterSeconds,
}, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_email_deliveries (
        notification_id, recipient_user_id, role_code, status, attempt_count,
        last_attempt_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'SENDING', 1, NOW(), NOW(), NOW())
      ON CONFLICT (notification_id, recipient_user_id) DO UPDATE
      SET status = 'SENDING',
          attempt_count = notification_email_deliveries.attempt_count + 1,
          last_attempt_at = NOW(),
          next_retry_at = NULL,
          updated_at = NOW()
      WHERE notification_email_deliveries.attempt_count < $4
        AND (
          (notification_email_deliveries.status = 'RETRY_PENDING'
            AND notification_email_deliveries.next_retry_at <= NOW())
          OR (notification_email_deliveries.status = 'SENDING'
            AND notification_email_deliveries.last_attempt_at <= NOW() - ($5::integer * INTERVAL '1 second'))
        )
      RETURNING *
    `,
    [notificationId, recipientUserId, roleCode, maxAttempts, staleAfterSeconds],
  );
  return result.rows[0] || null;
};

const markNotificationEmailDeliveryResult = async ({
  deliveryId, status, providerMessageId = null, errorCode = null,
  errorMessage = null, nextRetryAt = null,
}, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE notification_email_deliveries
      SET status = $2,
          provider_message_id = $3,
          last_error_code = $4,
          last_error_message_sanitized = $5,
          next_retry_at = $6,
          sent_at = CASE WHEN $2 = 'SENT' THEN NOW() ELSE sent_at END,
          updated_at = NOW()
      WHERE id = $1 AND status = 'SENDING'
      RETURNING *
    `,
    [deliveryId, status, providerMessageId, errorCode, errorMessage, nextRetryAt],
  );
  return result.rows[0] || null;
};

const markNotificationEmailDeliverySkipped = async ({ notificationId, recipientUserId, roleCode, reason }, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_email_deliveries (
        notification_id, recipient_user_id, role_code, status, last_error_code,
        created_at, updated_at
      ) VALUES ($1, $2, $3, 'SKIPPED', $4, NOW(), NOW())
      ON CONFLICT (notification_id, recipient_user_id) DO UPDATE
      SET status = 'SKIPPED', last_error_code = EXCLUDED.last_error_code, updated_at = NOW()
      WHERE notification_email_deliveries.status <> 'SENT'
      RETURNING *
    `,
    [notificationId, recipientUserId, roleCode, reason],
  );
  return result.rows[0] || null;
};

const markNotificationEmailDeliveryFailedWithoutAttempt = async ({ notificationId, recipientUserId, roleCode, reason }, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO notification_email_deliveries (
        notification_id, recipient_user_id, role_code, status, attempt_count,
        last_error_code, created_at, updated_at
      ) VALUES ($1, $2, $3, 'FAILED', 0, $4, NOW(), NOW())
      ON CONFLICT (notification_id, recipient_user_id) DO UPDATE
      SET status = 'FAILED', last_error_code = EXCLUDED.last_error_code,
          next_retry_at = NULL, updated_at = NOW()
      WHERE notification_email_deliveries.status <> 'SENT'
      RETURNING *
    `,
    [notificationId, recipientUserId, roleCode, reason],
  );
  return result.rows[0] || null;
};

const getRetryableNotificationEmailDeliveries = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT d.*, n.rule_code, n.type, n.title, n.message, n.severity, u.email
      FROM notification_email_deliveries d
      INNER JOIN notifications n ON n.id = d.notification_id
      INNER JOIN users u ON u.id = d.recipient_user_id
      WHERE (
          (d.status = 'RETRY_PENDING' AND d.next_retry_at <= NOW())
          OR (d.status = 'SENDING' AND d.last_attempt_at <= NOW() - (15 * INTERVAL '1 minute'))
        )
      ORDER BY d.next_retry_at ASC NULLS FIRST, d.created_at ASC
      LIMIT 100
    `,
  );
  return result.rows;
};

module.exports = {
  getNotificationRuleByCode,
  getNotificationPolicyRow,
  getNotificationPolicyRowsByRoleCode,
  getNotificationRulesByTargetRoleCode,
  getAllNotificationRules,
  upsertNotificationRule,
  upsertNotificationRuleRolePolicy,
  getRecipientUserIdsByRoleCode,
  getRecipientUserIdsByRoleCodeAndBarangayIds,
  getRoleCodesByUserId,
  getUserNotificationPreferencesByRole,
  insertSummaryEvent,
  getDueSummaryEvents,
  markSummaryEventsProcessed,
  getNotificationDeliveryState,
  upsertNotificationDeliveryState,
  insertNotification,
  findNotificationBySourceEventKey,
  insertNotificationRecipients,
  findRecentNotificationMatchForUsers,
  getNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getBatchesForExpiryNotificationScan,
  getFailedSyncTransactionsForNotificationScan,
  getOpenSyncConflictsForNotificationScan,
  ensureNotificationOutboxEvent,
  claimNotificationOutboxEventById,
  claimPendingNotificationOutboxEvents,
  markNotificationOutboxEventProcessed,
  markNotificationOutboxEventFailed,
  getSyncTransactionNotificationSourceById,
  getSyncConflictNotificationSourceById,
  claimNotificationEmailDelivery,
  markNotificationEmailDeliveryResult,
  markNotificationEmailDeliverySkipped,
  markNotificationEmailDeliveryFailedWithoutAttempt,
  getRetryableNotificationEmailDeliveries,
};
