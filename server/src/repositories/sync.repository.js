const pool = require("../config/db");
const notificationRepository = require("../modules/notifications/notification.repository");
const {
  CONFLICT_STATUS,
  RESOLUTION_STRATEGY,
  INVENTORY_STOCK_STATE_DRIFT,
} = require("../utils/syncConflictReviewPolicy");

const ACTIVE_PENDING_TIMEOUT_MINUTES = 5;
const RECOVERY_PROTOCOL_VERSION = 2;

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
      processing_protocol_version,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, NOW(), NOW())
    RETURNING *
  `;

  const values = [
    payload.client_sync_id,
    payload.processing_protocol_version || RECOVERY_PROTOCOL_VERSION,
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

const claimExistingSyncTransaction = async ({ payload, dbClient }) => {
  const existingResult = await dbClient.query(
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
    return {
      decision: "REUSE_MISMATCH",
      transaction: existingTransaction,
    };
  }

  if (existingTransaction.sync_status === "FAILED") {
    const retryResult = await dbClient.query(
      `
        UPDATE sync_transactions
        SET
          sync_status = 'PENDING',
          error_message = NULL,
          processing_protocol_version = COALESCE(processing_protocol_version, $2),
          updated_at = NOW()
        WHERE id = $1
          AND sync_status = 'FAILED'
        RETURNING *
      `,
      [existingTransaction.id, RECOVERY_PROTOCOL_VERSION],
    );

    return {
      decision: "CLAIMED_RETRY",
      transaction: retryResult.rows[0],
    };
  }

  if (existingTransaction.sync_status === "PENDING") {
    if (
      existingTransaction.is_stale_pending &&
      existingTransaction.processing_protocol_version === RECOVERY_PROTOCOL_VERSION
    ) {
      const retryResult = await dbClient.query(
        `
          UPDATE sync_transactions
          SET
            error_message = NULL,
            updated_at = NOW()
          WHERE id = $1
            AND sync_status = 'PENDING'
          RETURNING *
        `,
        [existingTransaction.id],
      );

      return {
        decision: "CLAIMED_STALE_RETRY",
        transaction: retryResult.rows[0],
      };
    }

    return {
      decision: existingTransaction.is_stale_pending
        ? "LEGACY_STALE_PENDING"
        : "IN_PROGRESS",
      transaction: existingTransaction,
    };
  }

  const conflictRecord =
    existingTransaction.sync_status === "CONFLICT"
      ? await getConflictForSyncTransaction(existingTransaction.id, dbClient)
      : null;

  return {
    decision: "REPLAY_TERMINAL",
    transaction: existingTransaction,
    conflictRecord,
  };
};

const claimSyncTransaction = async (payload, dbClient = null) => {
  if (dbClient) {
    const claimInsertSavepoint = "sync_claim_insert";

    await dbClient.query(`SAVEPOINT ${claimInsertSavepoint}`);

    try {
      const inserted = await insertSyncTransaction(payload, dbClient);
      await dbClient.query(`RELEASE SAVEPOINT ${claimInsertSavepoint}`);

      return {
        decision: "CLAIMED_NEW",
        transaction: inserted,
      };
    } catch (error) {
      if (
        error.code !== "23505" ||
        error.constraint !== "sync_transactions_client_sync_id_unique"
      ) {
        throw error;
      }

      try {
        await dbClient.query(`ROLLBACK TO SAVEPOINT ${claimInsertSavepoint}`);
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
        throw error;
      }
    }

    return claimExistingSyncTransaction({ payload, dbClient });
  }

  const insertClient = await pool.connect();

  try {
    await insertClient.query("BEGIN");

    const inserted = await insertSyncTransaction(payload, insertClient);
    await insertClient.query("COMMIT");

    return {
      decision: "CLAIMED_NEW",
      transaction: inserted,
    };
  } catch (error) {
    await insertClient.query("ROLLBACK");

    if (
      error.code !== "23505" ||
      error.constraint !== "sync_transactions_client_sync_id_unique"
    ) {
      throw error;
    }
  } finally {
    insertClient.release();
  }

  const lockClient = await pool.connect();

  try {
    await lockClient.query("BEGIN");

    const claim = await claimExistingSyncTransaction({
      payload,
      dbClient: lockClient,
    });

    await lockClient.query("COMMIT");
    return claim;
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
      resolution_action,
      resolution_reason,
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
      $8,
      $9,
      $10::jsonb,
      $11,
      $12,
      $13,
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
    payload.resolution_action || null,
    payload.resolution_reason || null,
    payload.resolved_payload_json === null
      ? null
      : JSON.stringify(payload.resolved_payload_json || {}),
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

// Sync transactions do not carry a Barangay column. Keep municipality-wide
// reads truthful by deriving context from the related operational record (or
// the validated payload for create attempts) at query time. This deliberately
// remains a read-only projection; the sync schema and write paths are unchanged.
const SYNC_UUID_PATTERN =
  "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const SYNC_MSWDO_ENTITY_SCOPE = `
  st.entity_type IN ('HOUSEHOLD', 'STUB', 'DISTRIBUTION_TRANSACTION')
`;

// Mayor Sync Center reads are limited to records created by the municipality's
// inventory domain. Keep this allowlist explicit: a municipality-wide read must
// not accidentally expose Barangay/MSWDO evacuee or distribution operations.
const SYNC_MAYOR_ENTITY_SCOPE = `
  st.entity_type IN ('INVENTORY_ITEM', 'INVENTORY_BATCH', 'INVENTORY_TRANSACTION')
`;

const SYNC_BARANGAY_ATTRIBUTION_CTE = `
  WITH sync_transaction_context AS (
    SELECT
      st.*,
      CASE
        WHEN COALESCE(
          st.payload_json #>> '{payload,barangay_id}',
          st.payload_json ->> 'barangay_id'
        ) ~* '${SYNC_UUID_PATTERN}'
        THEN COALESCE(
          st.payload_json #>> '{payload,barangay_id}',
          st.payload_json ->> 'barangay_id'
        )::uuid
        ELSE NULL
      END AS payload_barangay_id,
      CASE
        WHEN COALESCE(
          st.payload_json #>> '{payload,disaster_event_id}',
          st.payload_json ->> 'disaster_event_id'
        ) ~* '${SYNC_UUID_PATTERN}'
        THEN COALESCE(
          st.payload_json #>> '{payload,disaster_event_id}',
          st.payload_json ->> 'disaster_event_id'
        )::uuid
        ELSE NULL
      END AS payload_disaster_event_id,
      CASE
        WHEN COALESCE(
          st.payload_json #>> '{payload,household_id}',
          st.payload_json ->> 'household_id'
        ) ~* '${SYNC_UUID_PATTERN}'
        THEN COALESCE(
          st.payload_json #>> '{payload,household_id}',
          st.payload_json ->> 'household_id'
        )::uuid
        ELSE NULL
      END AS payload_household_id,
      CASE
        WHEN COALESCE(
          st.payload_json #>> '{payload,stub_id}',
          st.payload_json ->> 'stub_id'
        ) ~* '${SYNC_UUID_PATTERN}'
        THEN COALESCE(
          st.payload_json #>> '{payload,stub_id}',
          st.payload_json ->> 'stub_id'
        )::uuid
        ELSE NULL
      END AS payload_stub_id
    FROM sync_transactions st
  ),
  sync_barangay_attribution AS (
    SELECT
      st.id AS sync_transaction_id,
      COALESCE(
        h_household.disaster_event_id,
        h_evacuee.disaster_event_id,
        h_evacuation_log.disaster_event_id,
        s_stub.disaster_event_id,
        dt_distribution.disaster_event_id,
        st.payload_disaster_event_id
      ) AS disaster_event_id,
      COALESCE(
        h_household.barangay_id,
        h_evacuee.barangay_id,
        h_evacuation_log.barangay_id,
        h_stub.barangay_id,
        h_distribution.barangay_id,
        h_payload_household.barangay_id,
        h_payload_stub.barangay_id,
        st.payload_barangay_id,
        CASE
          WHEN st.entity_type IN ('HOUSEHOLD', 'STUB', 'DISTRIBUTION_TRANSACTION')
            AND st.operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'CLAIM', 'QR_SCAN', 'TIME_IN', 'TIME_OUT', 'PROOF_RECEIPT')
            AND u.default_barangay_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM user_roles ur_barangay
              INNER JOIN roles r_barangay
                ON r_barangay.id = ur_barangay.role_id
              WHERE ur_barangay.user_id = u.id
                AND r_barangay.code = 'BARANGAY'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM user_roles ur_other
              INNER JOIN roles r_other
                ON r_other.id = ur_other.role_id
              WHERE ur_other.user_id = u.id
                AND r_other.code IN ('MSWDO', 'MAYOR')
            )
          THEN u.default_barangay_id
          ELSE NULL
        END
      ) AS barangay_id
    FROM sync_transaction_context st
    LEFT JOIN users u
      ON u.id = st.user_id
    LEFT JOIN households h_household
      ON st.entity_type = 'HOUSEHOLD'
      AND h_household.id = st.entity_server_id
    LEFT JOIN evacuees e_evacuee
      ON st.entity_type = 'EVACUEE'
      AND e_evacuee.id = st.entity_server_id
    LEFT JOIN households h_evacuee
      ON h_evacuee.id = e_evacuee.household_id
    LEFT JOIN evacuation_logs el_evacuation_log
      ON st.entity_type = 'EVACUATION_LOG'
      AND el_evacuation_log.id = st.entity_server_id
    LEFT JOIN households h_evacuation_log
      ON h_evacuation_log.id = el_evacuation_log.household_id
    LEFT JOIN stubs s_stub
      ON st.entity_type = 'STUB'
      AND s_stub.id = st.entity_server_id
    LEFT JOIN households h_stub
      ON h_stub.id = s_stub.household_id
    LEFT JOIN distribution_transactions dt_distribution
      ON st.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND dt_distribution.id = st.entity_server_id
    LEFT JOIN households h_distribution
      ON h_distribution.id = dt_distribution.household_id
    LEFT JOIN households h_payload_household
      ON st.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND h_payload_household.id = st.payload_household_id
    LEFT JOIN stubs s_payload_stub
      ON st.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND s_payload_stub.id = st.payload_stub_id
    LEFT JOIN households h_payload_stub
      ON h_payload_stub.id = s_payload_stub.household_id
  )
`;

const appendSyncScopeFilter = (conditions, values, column, value) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  values.push(value);
  conditions.push(`${column} = $${values.length}`);
};

const selectAttributedSyncTransactionFields = `
  st.*,
  sba.disaster_event_id AS sync_history_disaster_event_id,
  sba.barangay_id AS barangay_id,
  b.name AS barangay_name
`;

const selectAttributedSyncConflictFields = `
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
  st.updated_at AS sync_transaction_updated_at,
  sba.disaster_event_id AS sync_history_disaster_event_id,
  sba.barangay_id AS barangay_id,
  b.name AS barangay_name
`;

const getSyncTransactionsByMunicipality = async ({
  syncStatus = null,
  barangayId = null,
  limit = 50,
  entityScope = SYNC_MSWDO_ENTITY_SCOPE,
}) => {
  const values = [];
  const conditions = [entityScope];

  appendSyncScopeFilter(conditions, values, "st.sync_status", syncStatus);
  appendSyncScopeFilter(conditions, values, "sba.barangay_id", barangayId);

  values.push(limit);

  const query = `
    ${SYNC_BARANGAY_ATTRIBUTION_CTE}
    SELECT ${selectAttributedSyncTransactionFields}
    FROM sync_transactions st
    LEFT JOIN sync_barangay_attribution sba
      ON sba.sync_transaction_id = st.id
    LEFT JOIN barangays b
      ON b.id = sba.barangay_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY st.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getSyncConflictsByMunicipality = async ({
  status = null,
  barangayId = null,
  limit = 50,
  entityScope = SYNC_MSWDO_ENTITY_SCOPE,
}) => {
  const values = [];
  const conditions = [entityScope];

  appendSyncScopeFilter(conditions, values, "sc.status", status);
  appendSyncScopeFilter(conditions, values, "sba.barangay_id", barangayId);

  values.push(limit);

  const query = `
    ${SYNC_BARANGAY_ATTRIBUTION_CTE}
    SELECT ${selectAttributedSyncConflictFields}
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    LEFT JOIN sync_barangay_attribution sba
      ON sba.sync_transaction_id = st.id
    LEFT JOIN barangays b
      ON b.id = sba.barangay_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY sc.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getSyncConflictByIdForMunicipality = async (
  { id, barangayId = null, entityScope = SYNC_MSWDO_ENTITY_SCOPE },
  dbClient = pool,
) => {
  const values = [id];
  const conditions = [
    "sc.id = $1",
    entityScope,
  ];

  appendSyncScopeFilter(conditions, values, "sba.barangay_id", barangayId);

  const query = `
    ${SYNC_BARANGAY_ATTRIBUTION_CTE}
    SELECT ${selectAttributedSyncConflictFields}
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    LEFT JOIN sync_barangay_attribution sba
      ON sba.sync_transaction_id = st.id
    LEFT JOIN barangays b
      ON b.id = sba.barangay_id
    WHERE ${conditions.join(" AND ")}
    LIMIT 1
  `;

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const countOpenSyncConflictsByMunicipality = async (
  { barangayId = null, entityScope = SYNC_MSWDO_ENTITY_SCOPE } = {},
  dbClient = pool,
) => {
  const values = [];
  const conditions = [
    entityScope,
    "sc.status = 'OPEN'",
  ];

  appendSyncScopeFilter(conditions, values, "sba.barangay_id", barangayId);

  const query = `
    ${SYNC_BARANGAY_ATTRIBUTION_CTE}
    SELECT COUNT(*)::int AS count
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    LEFT JOIN sync_barangay_attribution sba
      ON sba.sync_transaction_id = st.id
    WHERE ${conditions.join(" AND ")}
  `;

  const result = await dbClient.query(query, values);
  return result.rows[0]?.count || 0;
};

const getLastSuccessfulSyncAtForMunicipality = async (
  { barangayId = null, entityScope = SYNC_MSWDO_ENTITY_SCOPE } = {},
  dbClient = pool,
) => {
  const values = [];
  const conditions = [
    entityScope,
    "st.sync_status = 'SYNCED'",
  ];

  appendSyncScopeFilter(conditions, values, "sba.barangay_id", barangayId);

  const query = `
    ${SYNC_BARANGAY_ATTRIBUTION_CTE}
    SELECT COALESCE(st.server_timestamp, st.updated_at, st.created_at) AS last_successful_sync_at
    FROM sync_transactions st
    LEFT JOIN sync_barangay_attribution sba
      ON sba.sync_transaction_id = st.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY COALESCE(st.server_timestamp, st.updated_at, st.created_at) DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, values);
  return result.rows[0]?.last_successful_sync_at || null;
};

const getSyncTransactionsByMayor = async ({ syncStatus = null, limit = 50 } = {}) =>
  getSyncTransactionsByMunicipality({
    syncStatus,
    limit,
    barangayId: null,
    entityScope: SYNC_MAYOR_ENTITY_SCOPE,
  });

const getSyncConflictsByMayor = async ({ status = null, limit = 50 } = {}) =>
  getSyncConflictsByMunicipality({
    status,
    limit,
    barangayId: null,
    entityScope: SYNC_MAYOR_ENTITY_SCOPE,
  });

const getSyncConflictByIdForMayor = async ({ id } = {}, dbClient = pool) =>
  getSyncConflictByIdForMunicipality(
    {
      id,
      barangayId: null,
      entityScope: SYNC_MAYOR_ENTITY_SCOPE,
    },
    dbClient,
  );

const countOpenSyncConflictsByMayor = async (_options = {}, dbClient = pool) =>
  countOpenSyncConflictsByMunicipality(
    { barangayId: null, entityScope: SYNC_MAYOR_ENTITY_SCOPE },
    dbClient,
  );

const getLastSuccessfulSyncAtForMayor = async (_options = {}, dbClient = pool) =>
  getLastSuccessfulSyncAtForMunicipality(
    { barangayId: null, entityScope: SYNC_MAYOR_ENTITY_SCOPE },
    dbClient,
  );

const getDisasterEventTitlesByIds = async ({
  eventIds = [],
  roleCode = null,
  defaultBarangayId = null,
}) => {
  const uniqueEventIds = [...new Set((Array.isArray(eventIds) ? eventIds : []).filter(Boolean))];

  if (uniqueEventIds.length === 0) {
    return {};
  }

  const values = [uniqueEventIds];
  const conditions = ["de.id = ANY($1::uuid[])"];

  if (String(roleCode || "").toUpperCase() === "BARANGAY") {
    if (!defaultBarangayId) {
      return {};
    }

    values.push(defaultBarangayId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM disaster_event_barangays deb
        WHERE deb.disaster_event_id = de.id
          AND deb.barangay_id = $${values.length}
      )
    `);
  }

  const query = `
    SELECT de.id, de.title
    FROM disaster_events de
    WHERE ${conditions.join(" AND ")}
  `;

  const result = await pool.query(query, values);

  return result.rows.reduce((lookup, row) => {
    lookup[row.id] = row.title;
    return lookup;
  }, {});
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

const findHouseholdRegistrationSyncTransaction = async ({
  householdId,
  disasterEventId,
  excludeSyncTransactionId = null,
}, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT *
      FROM sync_transactions
      WHERE entity_type = 'HOUSEHOLD'
        AND operation_type = 'CREATE'
        AND entity_server_id = $1
        AND payload_json->>'action_key' IN ('HOUSEHOLD_REGISTER', 'HOUSEHOLD_RE_ADMISSION')
        AND ($2::uuid IS NULL OR id <> $2::uuid)
        AND ($3::uuid IS NULL OR payload_json->'payload'->>'disaster_event_id' = $3::text)
      ORDER BY client_timestamp ASC NULLS LAST, created_at ASC, id ASC
      LIMIT 1
    `,
    [householdId, excludeSyncTransactionId, disasterEventId || null],
  );
  return result.rows[0] || null;
};

const getBarangayNamesByIds = async (barangayIds, dbClient = pool) => {
  const ids = [...new Set((barangayIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return {};
  }

  const result = await dbClient.query(
    `SELECT id, name FROM barangays WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows.reduce((lookup, row) => {
    lookup[row.id] = row.name;
    return lookup;
  }, {});
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

const getReviewableManualInventoryConflicts = async ({ limit = 50 }) => {
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
    WHERE sc.status = $1
      AND sc.resolution_strategy = $2
      AND sc.conflict_type = $3
    ORDER BY sc.created_at DESC
    LIMIT $4
  `;

  const result = await pool.query(query, [
    CONFLICT_STATUS.OPEN,
    RESOLUTION_STRATEGY.MANUAL_REVIEW,
    INVENTORY_STOCK_STATE_DRIFT,
    limit,
  ]);

  return result.rows;
};

const getSyncConflictById = async ({ id }, dbClient = pool) => {
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
    LIMIT 1
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const lockSyncConflictById = async ({ id }, dbClient = pool) => {
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
    LIMIT 1
    FOR UPDATE OF sc
  `;

  const result = await dbClient.query(query, [id]);
  return result.rows[0] || null;
};

const markSyncConflictResolved = async (
  {
    conflictId,
    resolutionAction,
    resolutionReason = null,
    resolvedPayloadJson = {},
    resolvedBy,
  },
  dbClient = pool,
) => {
  const query = `
    UPDATE sync_conflicts
    SET
      status = 'RESOLVED',
      resolution_action = $2,
      resolution_reason = $3,
      resolved_payload_json = $4::jsonb,
      resolved_by = $5,
      resolved_at = NOW()
    WHERE id = $1
      AND status = 'OPEN'
    RETURNING *
  `;

  const result = await dbClient.query(query, [
    conflictId,
    resolutionAction,
    resolutionReason,
    JSON.stringify(resolvedPayloadJson || {}),
    resolvedBy,
  ]);

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

const countOpenReviewableManualInventoryConflicts = async (
  { userId },
  dbClient = pool,
) => {
  const query = `
    SELECT COUNT(DISTINCT sc.id)::int AS count
    FROM sync_conflicts sc
    INNER JOIN sync_transactions st
      ON st.id = sc.sync_transaction_id
    WHERE st.user_id <> $1
      AND sc.status = $2
      AND sc.resolution_strategy = $3
      AND sc.conflict_type = $4
  `;

  const result = await dbClient.query(query, [
    userId,
    CONFLICT_STATUS.OPEN,
    RESOLUTION_STRATEGY.MANUAL_REVIEW,
    INVENTORY_STOCK_STATE_DRIFT,
  ]);

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
  dbClient = null,
}) => {
  if (dbClient) {
    const conflictRecord = await insertSyncConflict(conflictPayload, dbClient);
    const syncTransaction = await updateSyncTransaction(
      syncTransactionId,
      transactionPayload,
      dbClient,
    );
    const notificationOutboxEvent =
      await notificationRepository.ensureNotificationOutboxEvent(
        {
          eventType: "SYNC_CONFLICT",
          sourceType: "SYNC_CONFLICT",
          sourceId: conflictRecord.id,
        },
        dbClient,
      );

    return {
      conflictRecord,
      syncTransaction,
      notificationOutboxEvent,
    };
  }

  const txClient = await pool.connect();

  try {
    await txClient.query("BEGIN");

    const conflictRecord = await insertSyncConflict(conflictPayload, txClient);
    const syncTransaction = await updateSyncTransaction(
      syncTransactionId,
      transactionPayload,
      txClient,
    );
    const notificationOutboxEvent =
      await notificationRepository.ensureNotificationOutboxEvent(
        {
          eventType: "SYNC_CONFLICT",
          sourceType: "SYNC_CONFLICT",
          sourceId: conflictRecord.id,
        },
        txClient,
      );

    await txClient.query("COMMIT");

    return {
      conflictRecord,
      syncTransaction,
      notificationOutboxEvent,
    };
  } catch (error) {
    await txClient.query("ROLLBACK");
    throw error;
  } finally {
    txClient.release();
  }
};

const recordSyncConflictOnly = async (conflictPayload, dbClient = pool) =>
  insertSyncConflict(conflictPayload, dbClient);

const recordSyncFailureAndNotificationIntent = async ({
  syncTransactionId,
  transactionPayload,
  dbClient = pool,
}) => {
  const syncTransaction = await updateSyncTransaction(
    syncTransactionId,
    {
      ...transactionPayload,
      sync_status: "FAILED",
    },
    dbClient,
  );

  const notificationOutboxEvent =
    await notificationRepository.ensureNotificationOutboxEvent(
      {
        eventType: "SYNC_FAILURE",
        sourceType: "SYNC_TRANSACTION",
        sourceId: syncTransactionId,
      },
      dbClient,
    );

  return {
    syncTransaction,
    notificationOutboxEvent,
  };
};

const withSyncProcessingTransaction = async (callback) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const result = await callback(dbClient);
    await dbClient.query("COMMIT");
    return result;
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  RECOVERY_PROTOCOL_VERSION,
  insertSyncTransaction,
  claimSyncTransaction,
  updateSyncTransaction,
  insertSyncConflict,
  getSyncConflictById,
  getConflictForSyncTransaction,
  recordConflictAndUpdateSyncTransaction,
  recordSyncConflictOnly,
  recordSyncFailureAndNotificationIntent,
  getSyncTransactionsByUser,
  getSyncTransactionsByMunicipality,
  getSyncTransactionsByMayor,
  getDisasterEventTitlesByIds,
  getSyncConflictsByUser,
  findHouseholdRegistrationSyncTransaction,
  getBarangayNamesByIds,
  getSyncConflictsByMunicipality,
  getSyncConflictsByMayor,
  getReviewableManualInventoryConflicts,
  getSyncConflictByIdForUser,
  getSyncConflictByIdForMunicipality,
  getSyncConflictByIdForMayor,
  lockSyncConflictById,
  markSyncConflictResolved,
  countOpenSyncConflictsByUser,
  countOpenSyncConflictsByMunicipality,
  countOpenSyncConflictsByMayor,
  countOpenReviewableManualInventoryConflicts,
  getLastSuccessfulSyncAtByUser,
  getLastSuccessfulSyncAtForMunicipality,
  getLastSuccessfulSyncAtForMayor,
  withSyncProcessingTransaction,
};
