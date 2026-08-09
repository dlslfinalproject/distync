const pool = require("../config/db");

const insertAuditLog = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO audit_logs (
      user_id,
      role_code,
      device_id,
      action,
      entity_type,
      entity_id,
      old_values_json,
      new_values_json,
      ip_address,
      source_event_key,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
    ON CONFLICT (source_event_key)
    WHERE source_event_key IS NOT NULL
    DO NOTHING
    RETURNING *
  `;

  const values = [
    payload.user_id || null,
    payload.role_code || null,
    payload.device_id || null,
    payload.action,
    payload.entity_type,
    payload.entity_id || null,
    JSON.stringify(payload.old_values_json || {}),
    JSON.stringify(payload.new_values_json || {}),
    payload.ip_address || null,
    payload.source_event_key || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertErrorLog = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO error_logs (
      user_id,
      device_id,
      module_name,
      error_code,
      error_message,
      stack_trace,
      severity,
      reference_type,
      reference_id,
      context_json,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
    RETURNING *
  `;

  const values = [
    payload.user_id || null,
    payload.device_id || null,
    payload.module_name,
    payload.error_code || null,
    payload.error_message,
    payload.stack_trace || null,
    payload.severity || "ERROR",
    payload.reference_type || null,
    payload.reference_id || null,
    JSON.stringify(payload.context_json || {}),
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getAuditLogs = async ({ limit = 50 } = {}, dbClient = pool) => {
  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT $1
  `;

  const result = await dbClient.query(query, [limit]);
  return result.rows;
};

const getErrorLogs = async ({ limit = 50 } = {}, dbClient = pool) => {
  const query = `
    SELECT
      el.id,
      el.module_name,
      el.error_code,
      el.error_message,
      el.stack_trace,
      el.severity,
      el.reference_type,
      el.reference_id,
      el.context_json,
      el.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM error_logs el
    LEFT JOIN users u ON u.id = el.user_id
    ORDER BY el.created_at DESC
    LIMIT $1
  `;

  const result = await dbClient.query(query, [limit]);
  return result.rows;
};

const getAuditLogsByEntity = async (
  { entityType, entityId, limit = 20 },
  dbClient = pool,
) => {
  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_type = $1
      AND al.entity_id = $2
    ORDER BY al.created_at DESC
    LIMIT $3
  `;

  const result = await dbClient.query(query, [entityType, entityId, limit]);
  return result.rows;
};

module.exports = {
  getAuditLogs,
  getAuditLogsByEntity,
  getErrorLogs,
  insertAuditLog,
  insertErrorLog,
};
