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

module.exports = {
  getNotificationRuleByCode,
  getRecipientUserIdsByRoleCode,
  insertNotification,
  insertNotificationRecipients,
  getNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
