const pool = require("../config/db");

const ACTIVE_PENDING_TIMEOUT_MINUTES = 5;

const normalizeJsonValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((normalized, key) => {
        normalized[key] = normalizeJsonValue(value[key]);
        return normalized;
      }, {});
  }

  return value;
};

const stableStringifyJson = (value) =>
  JSON.stringify(normalizeJsonValue(value || {}));

const insertSyncTransaction = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO sync_transactions (
      client_sync_id,
      device_id,
      user_id,
      entity_type,
      entity_local_id,
      entity_server_id,
      operation_type,
      payload_json,
      client_timestamp,
      server_timestamp,
      sync_status,
      error_message,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    payload.client_sync_id,
    payload.device_id || null,
    payload.user_id || null,
    payload.entity_type,
    payload.entity_local_id || null,
    payload.entity_server_id || null,
    payload.operation_type,
    JSON.stringify(payload.payload_json || {}),
    payload.client_timestamp,
    payload.server_timestamp || null,
    payload.sync_status,
    payload.error_message || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getConflictForSyncTransaction = async (syncTransactionId, dbClient = pool) => {
  const query = `
    SELECT *
    FROM sync_conflicts
    WHERE sync_transaction_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [syncTransactionId]);
  return result.rows[0] || null;
};

const isSameSyncRequest = (existingTransaction, payload) => {
  return (
    existingTransaction.user_id === payload.user_id &&
    (existingTransaction.device_id || null) === (payload.device_id || null) &&
    existingTransaction.entity_type === payload.entity_type &&
    (existingTransaction.entity_local_id || null) ===
      (payload.entity_local_id || null) &&
    (existingTransaction.entity_server_id || null) ===
      (payload.entity_server_id || null) &&
    existingTransaction.operation_type === payload.operation_type &&
    stableStringifyJson(existingTransaction.payload_json) ===
      stableStringifyJson(payload.payload_json) &&
    new Date(existingTransaction.client_timestamp).getTime() ===
      new Date(payload.client_timestamp).getTime()
  );
};

const claimSyncTransaction = async (payload) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const inserted = await insertSyncTransaction(payload, dbClient);
    await dbClient.query("COMMIT");

    return {
      decision: "CLAIMED_NEW",
      transaction: inserted,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");

    if (
      error.code !== "23505" ||
      error.constraint !== "sync_transactions_client_sync_id_unique"
    ) {
      throw error;
    }
  } finally {
    dbClient.release();
  }

  const lockClient = await pool.connect();

  try {
    await lockClient.query("BEGIN");

    const existingResult = await lockClient.query(
      `
        SELECT *,
          updated_at < NOW() - ($2::int * INTERVAL '1 minute') AS is_stale_pending
        FROM sync_transactions
        WHERE client_sync_id = $1
        FOR UPDATE
      `,
      [payload.client_sync_id, ACTIVE_PENDING_TIMEOUT_MINUTES],
    );

    const existingTransaction = existingResult.rows[0] || null;

    if (!existingTransaction || !isSameSyncRequest(existingTransaction, payload)) {
      await lockClient.query("ROLLBACK");
      return {
        decision: "REUSE_MISMATCH",
        transaction: existingTransaction,
      };
    }

    if (existingTransaction.sync_status === "FAILED") {
      const retryResult = await lockClient.query(
        `
          UPDATE sync_transactions
          SET
            sync_status = 'PENDING',
            error_message = NULL,
            updated_at = NOW()
          WHERE id = $1
            AND sync_status = 'FAILED'
          RETURNING *
        `,
        [existingTransaction.id],
      );

      await lockClient.query("COMMIT");

      return {
        decision: "CLAIMED_RETRY",
        transaction: retryResult.rows[0],
      };
    }

    if (existingTransaction.sync_status === "PENDING") {
      await lockClient.query("COMMIT");

      return {
        decision: existingTransaction.is_stale_pending
          ? "STALE_PENDING"
          : "IN_PROGRESS",
        transaction: existingTransaction,
      };
    }

    const conflictRecord =
      existingTransaction.sync_status === "CONFLICT"
        ? await getConflictForSyncTransaction(existingTransaction.id, lockClient)
        : null;

    await lockClient.query("COMMIT");

    return {
      decision: "REPLAY_TERMINAL",
      transaction: existingTransaction,
      conflictRecord,
    };
  } catch (error) {
    await lockClient.query("ROLLBACK");
    throw error;
  } finally {
    lockClient.release();
  }
};

const updateSyncTransaction = async (id, payload, dbClient = pool) => {
  const query = `
    UPDATE sync_transactions
    SET
      entity_server_id = COALESCE($2, entity_server_id),
      server_timestamp = COALESCE($3, server_timestamp),
      sync_status = COALESCE($4, sync_status),
      error_message = $5,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const values = [
    id,
    payload.entity_server_id || null,
    payload.server_timestamp || null,
    payload.sync_status || null,
    payload.error_message || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const insertSyncConflict = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO sync_conflicts (
      sync_transaction_id,
      entity_type,
      entity_server_id,
      conflict_type,
      local_payload_json,
      server_payload_json,
      resolution_strategy,
      resolved_payload_json,
      resolved_by,
      resolved_at,
      status,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      $6::jsonb,
      $7,
      $8::jsonb,
      $9,
      $10,
      $11,
      NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.sync_transaction_id,
    payload.entity_type,
    payload.entity_server_id || null,
    payload.conflict_type,
    JSON.stringify(payload.local_payload_json || {}),
    JSON.stringify(payload.server_payload_json || {}),
    payload.resolution_strategy,
    JSON.stringify(payload.resolved_payload_json || {}),
    payload.resolved_by || null,
    payload.resolved_at || null,
    payload.status || "OPEN",
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getSyncTransactionsByUser = async ({ userId, syncStatus = null, limit = 50 }) => {
  const values = [userId];
  const conditions = ["user_id = $1"];

  if (syncStatus) {
    values.push(syncStatus);
    conditions.push(`sync_status = $${values.length}`);
  }

  values.push(limit);

  const query = `
    SELECT *
    FROM sync_transactions
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getSyncConflictsByUser = async ({ userId, status = null, limit = 50 }) => {
  const values = [userId];
  const conditions = ["st.user_id = $1"];

  if (status) {
    values.push(status);
    conditions.push(`sc.status = $${values.length}`);
  }

  values.push(limit);

  const query = `
    SELECT
      sc.*,
      st.sync_status,
      st.error_message,
      st.client_timestamp,
      st.server_timestamp
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY sc.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getSyncConflictByIdForUser = async ({ id, userId }, dbClient = pool) => {
  const query = `
    SELECT
      sc.*,
      st.user_id,
      st.entity_local_id,
      st.sync_status,
      st.error_message,
      st.client_timestamp,
      st.server_timestamp,
      st.operation_type,
      st.payload_json,
      st.created_at AS sync_transaction_created_at,
      st.updated_at AS sync_transaction_updated_at
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    WHERE sc.id = $1
      AND st.user_id = $2
    LIMIT 1
  `;

  const result = await dbClient.query(query, [id, userId]);
  return result.rows[0] || null;
};

const countOpenSyncConflictsByUser = async ({ userId }, dbClient = pool) => {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    WHERE st.user_id = $1
      AND sc.status = 'OPEN'
  `;

  const result = await dbClient.query(query, [userId]);
  return result.rows[0]?.count || 0;
};

const getLastSuccessfulSyncAtByUser = async ({ userId }, dbClient = pool) => {
  const query = `
    SELECT COALESCE(server_timestamp, updated_at, created_at) AS last_successful_sync_at
    FROM sync_transactions
    WHERE user_id = $1
      AND sync_status = 'SYNCED'
    ORDER BY COALESCE(server_timestamp, updated_at, created_at) DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [userId]);
  return result.rows[0]?.last_successful_sync_at || null;
};

const recordConflictAndUpdateSyncTransaction = async ({
  syncTransactionId,
  conflictPayload,
  transactionPayload,
}) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const conflictRecord = await insertSyncConflict(conflictPayload, dbClient);
    const syncTransaction = await updateSyncTransaction(
      syncTransactionId,
      transactionPayload,
      dbClient,
    );

    await dbClient.query("COMMIT");

    return {
      conflictRecord,
      syncTransaction,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  insertSyncTransaction,
  claimSyncTransaction,
  updateSyncTransaction,
  insertSyncConflict,
  getConflictForSyncTransaction,
  recordConflictAndUpdateSyncTransaction,
  getSyncTransactionsByUser,
  getSyncConflictsByUser,
  getSyncConflictByIdForUser,
  countOpenSyncConflictsByUser,
  getLastSuccessfulSyncAtByUser,
};
