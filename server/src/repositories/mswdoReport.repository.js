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

  if (disasterEventId) {
    values.push(disasterEventId);
    distributionConditions.push(`dt.disaster_event_id = $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
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
    finalConditions.push("barangay_name IS NOT NULL");
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
    sync_failed AS (
      SELECT
        'SYNC_FAILED' AS anomaly_type,
        st.id::text AS reference_id,
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        NULL::text AS barangay_name,
        NULL::text AS family_head_name,
        COALESCE(st.error_message, 'Sync transaction failed.') AS anomaly_reason,
        st.sync_status AS status,
        st.created_at AS occurred_at,
        'Pending retry or investigation.' AS resolution_status
      FROM sync_transactions st
      WHERE ${syncFailedWhere}
    ),
    sync_conflict AS (
      SELECT
        'SYNC_CONFLICT' AS anomaly_type,
        sc.id::text AS reference_id,
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        NULL::text AS barangay_name,
        NULL::text AS family_head_name,
        CONCAT(sc.conflict_type, ' conflict for ', sc.entity_type) AS anomaly_reason,
        sc.status AS status,
        sc.created_at AS occurred_at,
        sc.resolution_strategy AS resolution_status
      FROM sync_conflicts sc
      INNER JOIN sync_transactions st ON st.id = sc.sync_transaction_id
      WHERE ${syncConflictWhere}
    ),
    duplicate_claim_attempts AS (
      SELECT
        'DUPLICATE_CLAIM_ATTEMPT' AS anomaly_type,
        el.id::text AS reference_id,
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        NULL::text AS barangay_name,
        NULL::text AS family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      WHERE el.module_name IN ('distribution', 'stubs')
        AND (
          el.error_message ILIKE '%already been used for distribution%'
          OR el.error_message ILIKE '%already claimed%'
        )
        ${errorWhere}
    ),
    failed_stub_verification AS (
      SELECT
        'FAILED_STUB_OR_QR_VERIFICATION' AS anomaly_type,
        el.id::text AS reference_id,
        NULL::text AS event_code,
        NULL::text AS disaster_event_title,
        NULL::text AS barangay_name,
        NULL::text AS family_head_name,
        el.error_message AS anomaly_reason,
        el.severity AS status,
        el.created_at AS occurred_at,
        'Captured through error logging.' AS resolution_status
      FROM error_logs el
      WHERE el.module_name IN ('stubs', 'distribution')
        AND (
          el.error_message ILIKE '%stub not found%'
          OR el.error_message ILIKE '%qr_reference_value does not match%'
          OR el.error_message ILIKE '%The scanned QR reference is not active%'
        )
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
