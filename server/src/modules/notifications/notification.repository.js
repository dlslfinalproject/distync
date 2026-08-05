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
      RETURNING id, code, name, trigger_type, target_role_code, is_active
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
      RETURNING *
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
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, NULL, NOW(), NOW())
      ON CONFLICT (summary_key) DO NOTHING
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
        type,
        title,
        message,
        severity,
        reference_type,
        reference_id,
        generated_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.disaster_event_id,
      payload.type,
      payload.title,
      payload.message,
      payload.severity,
      payload.reference_type,
      payload.reference_id,
    ],
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
  { status = "ALL", limit = 30 } = {},
  dbClient = pool,
) => {
  const values = [userId];
  const conditions = ["nr.user_id = $1"];

  if (status === "UNREAD") {
    conditions.push("nr.read_at IS NULL");
  }

  values.push(limit);

  const result = await dbClient.query(
    `
      SELECT
        n.id,
        nr.id AS recipient_id,
        nr.read_at,
        n.disaster_event_id,
        n.type,
        n.title,
        n.message,
        n.severity,
        n.reference_type,
        n.reference_id,
        n.generated_at,
        n.created_at,
        de.event_code,
        de.title AS disaster_event_title
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      LEFT JOIN disaster_events de ON de.id = n.disaster_event_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY nr.read_at ASC NULLS FIRST, n.generated_at DESC, n.created_at DESC
      LIMIT $2
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
        ib.batch_no,
        ib.quantity_available,
        ib.expiration_date,
        ib.status,
        ii.item_name
      FROM inventory_batches ib
      INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
      WHERE ib.expiration_date IS NOT NULL
        AND ib.quantity_available > 0
        AND (
          ib.expiration_date < CURRENT_DATE
          OR (
            ib.expiration_date >= CURRENT_DATE
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
  insertNotificationRecipients,
  findRecentNotificationMatchForUsers,
  getNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getBatchesForExpiryNotificationScan,
  getFailedSyncTransactionsForNotificationScan,
  getOpenSyncConflictsForNotificationScan,
};
