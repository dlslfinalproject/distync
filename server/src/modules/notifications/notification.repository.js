const pool = require("../../config/db");

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

const insertNotification = async (payload, dbClient = pool) => {
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
  getNotificationRulesByTargetRoleCode,
  upsertNotificationRule,
  getRecipientUserIdsByRoleCode,
  getRecipientUserIdsByRoleCodeAndBarangayIds,
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
