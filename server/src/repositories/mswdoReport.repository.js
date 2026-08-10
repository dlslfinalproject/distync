const pool = require("../config/db");

const getAnomalyOrderByClause = (order) => {
  const stableTieBreaker = `
      source_type ASC,
      source_id ASC
  `;

  if (order === "oldest") {
    return `
      occurred_at ASC NULLS FIRST,
      anomaly_type ASC,
      reference_id ASC NULLS LAST,
      ${stableTieBreaker}
    `;
  }

  if (order === "az" || order === "za") {
    const direction = order === "az" ? "ASC" : "DESC";

    return `
      LOWER(CONCAT_WS(' ', disaster_event_title, family_head_name)) ${direction},
      occurred_at DESC NULLS LAST,
      anomaly_type ASC,
      reference_id ASC NULLS LAST,
      ${stableTieBreaker}
    `;
  }

  return `
    occurred_at DESC NULLS LAST,
    anomaly_type ASC,
    reference_id ASC NULLS LAST,
    ${stableTieBreaker}
  `;
};

const getDisasterEventReportSummary = async ({
  disasterEventId = null,
  barangayId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  limit = 100,
}) => {
  const values = [];
  const conditions = [];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`de.id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`de.status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`de.start_date >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(`de.start_date <= $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM disaster_event_barangays deb_filter
        WHERE deb_filter.disaster_event_id = de.id
          AND deb_filter.barangay_id = $${values.length}
      )
    `);
  }

  values.push(limit);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      de.id,
      de.event_code,
      de.title,
      de.disaster_type,
      de.start_date,
      de.end_date,
      de.status,
      COUNT(DISTINCT deb.barangay_id)::int AS affected_barangays_count,
      COALESCE(
        STRING_AGG(DISTINCT b.name, ', ' ORDER BY b.name),
        '--'
      ) AS affected_barangays_text,
      COUNT(DISTINCT h.id)::int AS registered_households_count,
      COUNT(DISTINCT dt.id) FILTER (
        WHERE dt.distribution_status = 'CLAIMED'
      )::int AS distributed_aid_count,
      COUNT(DISTINCT s.id) FILTER (
        WHERE s.status = 'CLAIMED'
      )::int AS claimed_stubs_count,
      COUNT(DISTINCT s.id) FILTER (
        WHERE s.status = 'ISSUED'
      )::int AS unclaimed_stubs_count,
      COALESCE(SUM(dti.quantity_released), 0)::int AS quantity_released_total
    FROM disaster_events de
    LEFT JOIN disaster_event_barangays deb
      ON deb.disaster_event_id = de.id
    LEFT JOIN barangays b
      ON b.id = deb.barangay_id
    LEFT JOIN households h
      ON h.disaster_event_id = de.id
      AND (${
        barangayId ? `$${values.length - 1}::uuid IS NULL OR h.barangay_id = $${values.length - 1}` : "TRUE"
      })
    LEFT JOIN stubs s
      ON s.disaster_event_id = de.id
      AND (${
        barangayId ? `$${values.length - 1}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM households hs
          WHERE hs.id = s.household_id AND hs.barangay_id = $${values.length - 1}
        )` : "TRUE"
      })
    LEFT JOIN distribution_transactions dt
      ON dt.disaster_event_id = de.id
      AND (${
        barangayId ? `$${values.length - 1}::uuid IS NULL OR EXISTS (
          SELECT 1 FROM households hd
          WHERE hd.id = dt.household_id AND hd.barangay_id = $${values.length - 1}
        )` : "TRUE"
      })
    LEFT JOIN distribution_transaction_items dti
      ON dti.distribution_transaction_id = dt.id
    ${whereClause}
    GROUP BY
      de.id,
      de.event_code,
      de.title,
      de.disaster_type,
      de.start_date,
      de.end_date,
      de.status
    ORDER BY de.start_date DESC, de.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getMswdoAnomalyTracking = async ({
  disasterEventId = null,
  barangayId = null,
  status = null,
  statusCategory = null,
  anomalyType = null,
  search = null,
  order = "newest",
  dateFrom = null,
  dateTo = null,
  limit = null,
  page = 1,
  pageSize = null,
}) => {
  const effectivePageSize = pageSize || limit || 50;
  const values = [];
  const distributionConditions = ["dt.distribution_status = 'CLAIMED'"];
  const syncConditions = [];
  const errorConditions = [];
  let disasterEventParamIndex = null;
  let barangayParamIndex = null;

  if (disasterEventId) {
    values.push(disasterEventId);
    disasterEventParamIndex = values.length;
    distributionConditions.push(`dt.disaster_event_id = $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
    barangayParamIndex = values.length;
    distributionConditions.push(`h.barangay_id = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    distributionConditions.push(`dt.distribution_date >= $${values.length}`);
    syncConditions.push(`st.created_at >= $${values.length}`);
    errorConditions.push(`el.created_at >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    distributionConditions.push(
      `dt.distribution_date < ($${values.length}::date + INTERVAL '1 day')`,
    );
    syncConditions.push(`st.created_at < ($${values.length}::date + INTERVAL '1 day')`);
    errorConditions.push(`el.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  const statusIndex = status ? values.push(status) : null;
  const anomalyTypeIndex = anomalyType ? values.push(anomalyType) : null;
  const statusCategoryIndex = statusCategory ? values.push(statusCategory) : null;
  const searchIndex = search ? values.push(`%${search}%`) : null;

  const suspiciousDistributionWhere = distributionConditions.join(" AND ");
  const syncFailedWhere = [
    "st.sync_status = 'FAILED'",
    ...syncConditions,
  ].join(" AND ");
  const syncConflictWhere = [
    "sc.status = 'OPEN'",
    ...syncConditions,
  ].join(" AND ");
  const errorWhere = errorConditions.length > 0 ? `AND ${errorConditions.join(" AND ")}` : "";
  const finalConditions = [];

  if (statusIndex) {
    finalConditions.push(`status = $${statusIndex}`);
  }

  if (anomalyTypeIndex) {
    finalConditions.push(`anomaly_type = $${anomalyTypeIndex}`);
  }

  if (statusCategoryIndex) {
    finalConditions.push(`
      CASE
        WHEN UPPER(COALESCE(status, '')) IN ('FAILED', 'ERROR') THEN 'failed'
        WHEN UPPER(COALESCE(status, '')) = 'OPEN'
          OR UPPER(COALESCE(resolution_status, '')) LIKE '%PENDING%'
          OR UPPER(COALESCE(resolution_status, '')) LIKE '%RECOMMENDED%'
        THEN 'open'
        ELSE 'resolved'
      END = $${statusCategoryIndex}
    `);
  }

  if (searchIndex) {
    finalConditions.push(`
      (
        anomaly_type ILIKE $${searchIndex}
        OR COALESCE(event_code, '') ILIKE $${searchIndex}
        OR COALESCE(disaster_event_title, '') ILIKE $${searchIndex}
        OR COALESCE(barangay_name, '') ILIKE $${searchIndex}
        OR COALESCE(family_head_name, '') ILIKE $${searchIndex}
        OR COALESCE(anomaly_reason, '') ILIKE $${searchIndex}
        OR COALESCE(status, '') ILIKE $${searchIndex}
        OR COALESCE(resolution_status, '') ILIKE $${searchIndex}
      )
    `);
  }

  if (barangayId) {
    finalConditions.push(`barangay_id = $${barangayParamIndex}`);
  }

  const finalWhere = finalConditions.length
    ? `WHERE ${finalConditions.join(" AND ")}`
    : "";

  const anomalyRelationSql = `
    WITH suspicious_distribution AS (
      SELECT
        'SUSPICIOUS_DISTRIBUTION_ACTIVITY' AS anomaly_type,
        CONCAT(dt.household_id::text, ':', dt.disaster_event_id::text) AS reference_id,
        'SUSPICIOUS_DISTRIBUTION_ACTIVITY' AS source_type,
        CONCAT(dt.household_id::text, ':', dt.disaster_event_id::text) AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        CONCAT_WS(
          ' ',
          h.family_head_first_name,
          h.family_head_middle_name,
          h.family_head_last_name,
          h.family_head_suffix
        ) AS family_head_name,
        CONCAT(
          'Household has ',
          COUNT(*),
          ' claimed distribution records for the same disaster event.'
        ) AS anomaly_reason,
        'CLAIMED' AS status,
        MAX(dt.distribution_date) AS occurred_at,
        'Distribution history review recommended.' AS resolution_status
      FROM distribution_transactions dt
      INNER JOIN households h ON h.id = dt.household_id
      INNER JOIN barangays b ON b.id = h.barangay_id
      INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
      WHERE ${suspiciousDistributionWhere}
      GROUP BY
        dt.household_id,
        dt.disaster_event_id,
        de.event_code,
        de.title,
        b.id,
        b.name,
        h.family_head_first_name,
        h.family_head_middle_name,
        h.family_head_last_name,
        h.family_head_suffix
      HAVING COUNT(*) > 1
    ),
    sync_barangay_attribution AS (
      SELECT
        st.id AS sync_transaction_id,
        COALESCE(
          h_household.disaster_event_id,
          h_evacuee.disaster_event_id,
          h_evacuation_log.disaster_event_id,
          s_stub.disaster_event_id,
          dt_distribution.disaster_event_id
        ) AS disaster_event_id,
        COALESCE(
          h_household.barangay_id,
          h_evacuee.barangay_id,
          h_evacuation_log.barangay_id,
          h_stub.barangay_id,
          h_distribution.barangay_id,
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
        ) AS barangay_id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            h_household.family_head_first_name,
            h_household.family_head_middle_name,
            h_household.family_head_last_name,
            h_household.family_head_suffix
          )), ''),
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            h_evacuee.family_head_first_name,
            h_evacuee.family_head_middle_name,
            h_evacuee.family_head_last_name,
            h_evacuee.family_head_suffix
          )), ''),
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            h_evacuation_log.family_head_first_name,
            h_evacuation_log.family_head_middle_name,
            h_evacuation_log.family_head_last_name,
            h_evacuation_log.family_head_suffix
          )), ''),
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            h_stub.family_head_first_name,
            h_stub.family_head_middle_name,
            h_stub.family_head_last_name,
            h_stub.family_head_suffix
          )), ''),
          NULLIF(TRIM(CONCAT_WS(
            ' ',
            h_distribution.family_head_first_name,
            h_distribution.family_head_middle_name,
            h_distribution.family_head_last_name,
            h_distribution.family_head_suffix
          )), '')
        ) AS family_head_name
      FROM sync_transactions st
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
    ),
    error_barangay_attribution AS (
      SELECT
        el.id AS error_log_id,
        COALESCE(h_direct.disaster_event_id, s_error.disaster_event_id) AS disaster_event_id,
        COALESCE(
          h_direct.barangay_id,
          h_error.barangay_id,
          CASE
            WHEN el.reference_type IS NULL
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
        ) AS barangay_id,
        NULLIF(TRIM(CONCAT_WS(
          ' ',
          COALESCE(h_direct.family_head_first_name, h_error.family_head_first_name),
          COALESCE(h_direct.family_head_middle_name, h_error.family_head_middle_name),
          COALESCE(h_direct.family_head_last_name, h_error.family_head_last_name),
          COALESCE(h_direct.family_head_suffix, h_error.family_head_suffix)
        )), '') AS family_head_name
      FROM error_logs el
      LEFT JOIN users u
        ON u.id = el.user_id
      LEFT JOIN households h_direct
        ON el.reference_type = 'HOUSEHOLD'
        AND h_direct.id = el.reference_id
      LEFT JOIN stubs s_error
        ON el.reference_type = 'STUB'
        AND s_error.id = el.reference_id
      LEFT JOIN households h_error
        ON h_error.id = s_error.household_id
      WHERE el.module_name IN ('distribution', 'stubs', 'household-registration')
    ),
    sync_failed AS (
      SELECT
        'SYNC_FAILED' AS anomaly_type,
        st.id::text AS reference_id,
        'SYNC_TRANSACTION' AS source_type,
        st.id::text AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        NULLIF(TRIM(sba.family_head_name), '') AS family_head_name,
        COALESCE(st.error_message, 'Sync transaction failed.') AS anomaly_reason,
        st.sync_status AS status,
        st.created_at AS occurred_at,
        'Pending retry or investigation.' AS resolution_status
      FROM sync_transactions st
      LEFT JOIN sync_barangay_attribution sba
        ON sba.sync_transaction_id = st.id
      LEFT JOIN barangays b
        ON b.id = sba.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = sba.disaster_event_id
      WHERE ${syncFailedWhere}
        ${disasterEventId ? `AND sba.disaster_event_id = $${disasterEventParamIndex}` : ""}
    ),
    sync_conflict AS (
      SELECT
        'SYNC_CONFLICT' AS anomaly_type,
        sc.id::text AS reference_id,
        'SYNC_CONFLICT' AS source_type,
        sc.id::text AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        NULLIF(TRIM(sba.family_head_name), '') AS family_head_name,
        CONCAT(sc.conflict_type, ' conflict for ', sc.entity_type) AS anomaly_reason,
        sc.status AS status,
        sc.created_at AS occurred_at,
        sc.resolution_strategy AS resolution_status
      FROM sync_conflicts sc
      INNER JOIN sync_transactions st ON st.id = sc.sync_transaction_id
      LEFT JOIN sync_barangay_attribution sba
        ON sba.sync_transaction_id = st.id
      LEFT JOIN barangays b
        ON b.id = sba.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = sba.disaster_event_id
      WHERE ${syncConflictWhere}
        ${disasterEventId ? `AND sba.disaster_event_id = $${disasterEventParamIndex}` : ""}
    ),
    duplicate_claim_attempts AS (
      SELECT
        'DUPLICATE_CLAIM_ATTEMPT' AS anomaly_type,
        el.id::text AS reference_id,
        'ERROR_LOG' AS source_type,
        el.id::text AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        eba.family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      LEFT JOIN error_barangay_attribution eba
        ON eba.error_log_id = el.id
      LEFT JOIN barangays b
        ON b.id = eba.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = eba.disaster_event_id
      WHERE el.module_name IN ('distribution', 'stubs')
        AND el.error_code = 'STUB_ALREADY_CLAIMED'
        ${disasterEventId ? `AND eba.disaster_event_id = $${disasterEventParamIndex}` : ""}
        ${errorWhere}
    ),
    duplicate_household_registration AS (
      SELECT
        'DUPLICATE_HOUSEHOLD_REGISTRATION' AS anomaly_type,
        el.id::text AS reference_id,
        'ERROR_LOG' AS source_type,
        el.id::text AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        eba.family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      LEFT JOIN error_barangay_attribution eba
        ON eba.error_log_id = el.id
      LEFT JOIN barangays b
        ON b.id = eba.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = eba.disaster_event_id
      WHERE el.module_name = 'household-registration'
        AND el.error_code = 'DUPLICATE_HOUSEHOLD_REGISTRATION'
        ${disasterEventId ? `AND eba.disaster_event_id = $${disasterEventParamIndex}` : ""}
        ${errorWhere}
    ),
    failed_stub_verification AS (
      SELECT
        'FAILED_STUB_OR_QR_VERIFICATION' AS anomaly_type,
        el.id::text AS reference_id,
        'ERROR_LOG' AS source_type,
        el.id::text AS source_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        eba.family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      LEFT JOIN error_barangay_attribution eba
        ON eba.error_log_id = el.id
      LEFT JOIN barangays b
        ON b.id = eba.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = eba.disaster_event_id
      WHERE el.module_name IN ('stubs', 'distribution')
        AND el.error_code IN (
          'INVALID_QR_STUB',
          'STUB_NOT_FOUND',
          'QR_REFERENCE_MISMATCH',
          'QR_INACTIVE',
          'STUB_NOT_CLAIMABLE',
          'STUB_CANCELLED',
          'STUB_VOID',
          'STUB_UNAVAILABLE'
        )
        ${disasterEventId ? `AND eba.disaster_event_id = $${disasterEventParamIndex}` : ""}
        ${errorWhere}
    ),
    anomaly_rows AS (
      SELECT * FROM suspicious_distribution
      UNION ALL
      SELECT * FROM sync_failed
      UNION ALL
      SELECT * FROM sync_conflict
      UNION ALL
      SELECT * FROM duplicate_claim_attempts
      UNION ALL
      SELECT * FROM duplicate_household_registration
      UNION ALL
      SELECT * FROM failed_stub_verification
    ),
    filtered_anomalies AS (
      SELECT *
      FROM anomaly_rows
      ${finalWhere}
    )
  `;

  const countResult = await pool.query(
    `
      ${anomalyRelationSql}
      SELECT COUNT(*)::int AS total_items
      FROM filtered_anomalies
    `,
    values,
  );

  const totalItems = countResult.rows[0]?.total_items || 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / effectivePageSize);
  const offset = (page - 1) * effectivePageSize;
  const itemValues = [...values, effectivePageSize, offset];
  const limitIndex = itemValues.length - 1;
  const offsetIndex = itemValues.length;
  const result = await pool.query(
    `
      ${anomalyRelationSql}
      SELECT
        anomaly_type,
        reference_id,
        event_code,
        disaster_event_title,
        barangay_id,
        barangay_name,
        family_head_name,
        anomaly_reason,
        status,
        occurred_at,
        resolution_status
      FROM filtered_anomalies
      ORDER BY ${getAnomalyOrderByClause(order)}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    itemValues,
  );

  return {
    items: result.rows,
    pagination: {
      page,
      pageSize: effectivePageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: totalPages > 0 && page < totalPages,
    },
  };
};

module.exports = {
  getDisasterEventReportSummary,
  getMswdoAnomalyTracking,
};
