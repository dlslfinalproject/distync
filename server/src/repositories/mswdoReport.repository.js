const pool = require("../config/db");

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
  dateFrom = null,
  dateTo = null,
  limit = 100,
}) => {
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
  values.push(limit);
  const limitIndex = values.length;

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

  if (barangayId) {
    finalConditions.push(`barangay_id = $${barangayParamIndex}`);
  }

  const finalWhere = finalConditions.length
    ? `WHERE ${finalConditions.join(" AND ")}`
    : "";

  const query = `
    WITH suspicious_distribution AS (
      SELECT
        'SUSPICIOUS_DISTRIBUTION_ACTIVITY' AS anomaly_type,
        dt.id::text AS reference_id,
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
          COUNT(*) OVER (PARTITION BY dt.household_id, dt.disaster_event_id),
          ' claimed distribution records for the same disaster event.'
        ) AS anomaly_reason,
        dt.distribution_status AS status,
        dt.distribution_date AS occurred_at,
        'Distribution history review recommended.' AS resolution_status
      FROM distribution_transactions dt
      INNER JOIN households h ON h.id = dt.household_id
      INNER JOIN barangays b ON b.id = h.barangay_id
      INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
      WHERE ${suspiciousDistributionWhere}
    ),
    suspicious_distribution_filtered AS (
      SELECT *
      FROM suspicious_distribution
      WHERE anomaly_reason NOT LIKE 'Household has 1 claimed%'
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
        u.default_barangay_id AS barangay_id
      FROM error_logs el
      INNER JOIN users u
        ON u.id = el.user_id
      WHERE el.module_name IN ('distribution', 'stubs')
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
    ),
    sync_failed AS (
      SELECT
        'SYNC_FAILED' AS anomaly_type,
        st.id::text AS reference_id,
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
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        NULL::text AS family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      LEFT JOIN error_barangay_attribution eba
        ON eba.error_log_id = el.id
      LEFT JOIN barangays b
        ON b.id = eba.barangay_id
      WHERE el.module_name IN ('distribution', 'stubs')
        AND (
          el.error_message ILIKE '%already been used for distribution%'
          OR el.error_message ILIKE '%already claimed%'
        )
        ${disasterEventId ? "AND FALSE" : ""}
        ${errorWhere}
    ),
    failed_stub_verification AS (
      SELECT
        'FAILED_STUB_OR_QR_VERIFICATION' AS anomaly_type,
        el.id::text AS reference_id,
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        NULL::text AS family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      LEFT JOIN error_barangay_attribution eba
        ON eba.error_log_id = el.id
      LEFT JOIN barangays b
        ON b.id = eba.barangay_id
      WHERE el.module_name IN ('stubs', 'distribution')
        AND (
          el.error_message ILIKE '%stub not found%'
          OR el.error_message ILIKE '%qr_reference_value does not match%'
          OR el.error_message ILIKE '%The scanned QR reference is not active%'
        )
        ${disasterEventId ? "AND FALSE" : ""}
        ${errorWhere}
    )
    SELECT *
    FROM (
      SELECT * FROM suspicious_distribution_filtered
      UNION ALL
      SELECT * FROM sync_failed
      UNION ALL
      SELECT * FROM sync_conflict
      UNION ALL
      SELECT * FROM duplicate_claim_attempts
      UNION ALL
      SELECT * FROM failed_stub_verification
    ) anomalies
    ${finalWhere}
    ORDER BY occurred_at DESC
    LIMIT $${limitIndex}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

module.exports = {
  getDisasterEventReportSummary,
  getMswdoAnomalyTracking,
};
