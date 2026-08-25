const pool = require("../config/db");

const MANUAL_REVIEW_ANOMALY_TYPES = [
  "SUSPICIOUS_DISTRIBUTION_ACTIVITY",
  "DUPLICATE_HOUSEHOLD_REGISTRATION",
  "INVENTORY_DISTRIBUTION_MISMATCH",
  "FAILED_STUB_OR_QR_VERIFICATION",
];

const getAnomalyReviewStateExpression = ({
  anomalyAlias = "",
  reviewAlias = "",
} = {}) => {
  const anomalyPrefix = anomalyAlias ? `${anomalyAlias}.` : "";
  const reviewPrefix = reviewAlias ? `${reviewAlias}.` : "";

  return `
  CASE
    WHEN ${anomalyPrefix}anomaly_type = 'DUPLICATE_CLAIM_ATTEMPT'
      THEN 'system_handled'
    WHEN ${anomalyPrefix}anomaly_type IN ('SYNC_CONFLICT', 'SYNC_FAILED')
      THEN 'sync_center'
    WHEN ${reviewPrefix}review_status = 'REFERRED'
      THEN 'referred'
    WHEN ${reviewPrefix}review_status IN ('REVIEWED_VALID', 'ISSUE_CONFIRMED')
      THEN 'reviewed'
    WHEN ${anomalyPrefix}anomaly_type IN (${MANUAL_REVIEW_ANOMALY_TYPES.map((type) => `'${type}'`).join(", ")})
      THEN 'needs_review'
    ELSE 'system_handled'
  END
`;
};

const getManualReviewAllowedExpression = (anomalyAlias = "") => `
  ${anomalyAlias ? `${anomalyAlias}.` : ""}anomaly_type IN (${MANUAL_REVIEW_ANOMALY_TYPES.map((type) => `'${type}'`).join(", ")})
  AND ${anomalyAlias ? `${anomalyAlias}.` : ""}barangay_id IS NOT NULL
`;

const getOperationalAnomalySearchExpression = (anomalyAlias = "") => {
  const prefix = anomalyAlias ? `${anomalyAlias}.` : "";

  return `
    CASE ${prefix}anomaly_type
      WHEN 'SUSPICIOUS_DISTRIBUTION_ACTIVITY'
        THEN CONCAT('Distribution Record Issue ', COALESCE(${prefix}anomaly_reason, ''))
      WHEN 'SYNC_FAILED'
        THEN 'Synchronization Issue Detected Sync Center Review'
      WHEN 'SYNC_CONFLICT'
        THEN 'Synchronization Conflict Detected Sync Center Review'
      WHEN 'DUPLICATE_CLAIM_ATTEMPT'
        THEN 'Duplicate Claim Attempt Dismissed Automatically Handled'
      WHEN 'DUPLICATE_HOUSEHOLD_REGISTRATION'
        THEN 'Duplicate Household Record Open Needs Review'
      WHEN 'INVENTORY_DISTRIBUTION_MISMATCH'
        THEN CONCAT('Inventory-Distribution Mismatch ', COALESCE(${prefix}anomaly_reason, ''))
      WHEN 'FAILED_STUB_OR_QR_VERIFICATION'
        THEN 'Stub or QR Verification Issue Open Needs Review'
      ELSE REPLACE(COALESCE(${prefix}anomaly_type, ''), '_', ' ')
    END
  `;
};

const getOperationalReviewSearchExpression = ({
  anomalyAlias = "",
  reviewAlias = "",
} = {}) => {
  const anomalyPrefix = anomalyAlias ? `${anomalyAlias}.` : "";
  const reviewPrefix = reviewAlias ? `${reviewAlias}.` : "";

  return `
    CASE
      WHEN ${reviewPrefix}review_status = 'REVIEWED_VALID'
        THEN 'Dismissed No Issue Reviewed Valid'
      WHEN ${reviewPrefix}review_status = 'ISSUE_CONFIRMED'
        THEN 'Issue Confirmed Reviewed Resolved'
      WHEN ${reviewPrefix}review_status = 'REFERRED'
        THEN 'Referred for Resolution'
      WHEN ${anomalyPrefix}anomaly_type = 'DUPLICATE_CLAIM_ATTEMPT'
        THEN 'Dismissed Automatically Handled'
      WHEN ${anomalyPrefix}anomaly_type IN ('SYNC_CONFLICT', 'SYNC_FAILED')
        THEN 'Sync Center Review Synchronization Issue'
      ELSE 'Open Needs Review'
    END
  `;
};

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
  reviewState = null,
  roleScope = null,
  dateFrom = null,
  dateTo = null,
  sourceType = null,
  sourceId = null,
  limit = null,
  page = 1,
  pageSize = null,
}) => {
  const effectivePageSize = pageSize || limit || 50;
  const isBarangayScope = roleScope === "BARANGAY";
  const values = [];
  const distributionConditions = ["dt.distribution_status = 'CLAIMED'"];
  const reconciliationDistributionConditions = ["dt.distribution_status = 'CLAIMED'"];
  const reconciliationOutflowConditions = [
    "it.transaction_type = 'OUTFLOW'",
    "it.reference_type = 'DISTRIBUTION'",
  ];
  const syncConditions = [];
  const errorConditions = [];
  let disasterEventParamIndex = null;
  let barangayParamIndex = null;

  if (disasterEventId) {
    values.push(disasterEventId);
    disasterEventParamIndex = values.length;
    distributionConditions.push(`dt.disaster_event_id = $${values.length}`);
    reconciliationDistributionConditions.push(
      `dt.disaster_event_id = $${values.length}`,
    );
    reconciliationOutflowConditions.push(
      `COALESCE(dt.disaster_event_id, it.disaster_event_id) = $${values.length}`,
    );
  }

  if (barangayId) {
    values.push(barangayId);
    barangayParamIndex = values.length;
    distributionConditions.push(`h.barangay_id = $${values.length}`);
    reconciliationDistributionConditions.push(`h.barangay_id = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    distributionConditions.push(`dt.distribution_date >= $${values.length}`);
    reconciliationDistributionConditions.push(
      `dt.distribution_date >= $${values.length}`,
    );
    reconciliationOutflowConditions.push(`it.performed_at >= $${values.length}`);
    syncConditions.push(`st.created_at >= $${values.length}`);
    errorConditions.push(`el.created_at >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    distributionConditions.push(
      `dt.distribution_date < ($${values.length}::date + INTERVAL '1 day')`,
    );
    reconciliationDistributionConditions.push(
      `dt.distribution_date < ($${values.length}::date + INTERVAL '1 day')`,
    );
    reconciliationOutflowConditions.push(
      `it.performed_at < ($${values.length}::date + INTERVAL '1 day')`,
    );
    syncConditions.push(`st.created_at < ($${values.length}::date + INTERVAL '1 day')`);
    errorConditions.push(`el.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  const statusIndex = status ? values.push(status) : null;
  const anomalyTypeIndex = anomalyType ? values.push(anomalyType) : null;
  const statusCategoryIndex = statusCategory ? values.push(statusCategory) : null;
  const searchIndex = search ? values.push(`%${search}%`) : null;
  const reviewStateIndex = reviewState ? values.push(reviewState) : null;
  const sourceTypeIndex = sourceType ? values.push(sourceType) : null;
  const sourceIdIndex = sourceId ? values.push(sourceId) : null;

  const suspiciousDistributionWhere = distributionConditions.join(" AND ");
  const reconciliationDistributionWhere =
    reconciliationDistributionConditions.join(" AND ");
  const reconciliationOutflowWhere = reconciliationOutflowConditions.join(" AND ");
  const syncFailedWhere = [
    "st.sync_status = 'FAILED'",
    ...syncConditions,
  ].join(" AND ");
  const syncConflictWhere = [
    "sc.status = 'OPEN'",
    ...syncConditions,
  ].join(" AND ");
  const errorWhere = errorConditions.length > 0 ? `AND ${errorConditions.join(" AND ")}` : "";
  const barangayVerificationNoiseExclusion = isBarangayScope
    ? `
        AND NOT (
          el.error_code IN ('INVALID_QR_STUB', 'STUB_NOT_FOUND')
          AND el.reference_id IS NULL
          AND eba.family_head_name IS NULL
        )
      `
    : "";
  const finalConditions = [];

  if (statusIndex) {
    finalConditions.push(`anomaly_rows.status = $${statusIndex}`);
  }

  if (anomalyTypeIndex) {
    finalConditions.push(`anomaly_rows.anomaly_type = $${anomalyTypeIndex}`);
  }

  if (statusCategoryIndex) {
    finalConditions.push(`
      CASE
        WHEN UPPER(COALESCE(anomaly_rows.status, '')) IN ('FAILED', 'ERROR') THEN 'failed'
        WHEN UPPER(COALESCE(anomaly_rows.status, '')) = 'OPEN'
          OR UPPER(COALESCE(anomaly_rows.resolution_status, '')) LIKE '%PENDING%'
          OR UPPER(COALESCE(anomaly_rows.resolution_status, '')) LIKE '%RECOMMENDED%'
        THEN 'open'
        ELSE 'resolved'
      END = $${statusCategoryIndex}
    `);
  }

  if (searchIndex) {
    finalConditions.push(`
      (
        anomaly_rows.anomaly_type ILIKE $${searchIndex}
        OR REPLACE(anomaly_rows.anomaly_type, '_', ' ') ILIKE $${searchIndex}
        OR ${getOperationalAnomalySearchExpression("anomaly_rows")} ILIKE $${searchIndex}
        OR COALESCE(anomaly_rows.event_code, '') ILIKE $${searchIndex}
        OR COALESCE(anomaly_rows.disaster_event_title, '') ILIKE $${searchIndex}
        OR COALESCE(anomaly_rows.barangay_name, '') ILIKE $${searchIndex}
        OR COALESCE(anomaly_rows.family_head_name, '') ILIKE $${searchIndex}
        OR COALESCE(anomaly_rows.status, '') ILIKE $${searchIndex}
        OR COALESCE(ar.resolution_reason, '') ILIKE $${searchIndex}
        OR ${getOperationalReviewSearchExpression({ anomalyAlias: "anomaly_rows", reviewAlias: "ar" })} ILIKE $${searchIndex}
      )
    `);
  }

  if (reviewStateIndex) {
    finalConditions.push(`${getAnomalyReviewStateExpression({ anomalyAlias: "anomaly_rows", reviewAlias: "ar" })} = $${reviewStateIndex}`);
  }

  if (sourceTypeIndex) {
    finalConditions.push(`anomaly_rows.source_type = $${sourceTypeIndex}`);
  }

  if (sourceIdIndex) {
    finalConditions.push(`anomaly_rows.source_id = $${sourceIdIndex}`);
  }

  if (barangayId) {
    finalConditions.push(`anomaly_rows.barangay_id = $${barangayParamIndex}`);
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
        dt.disaster_event_id AS disaster_event_id,
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
    reconciliation_expected AS (
      SELECT
        dt.id AS distribution_transaction_id,
        dt.disaster_event_id,
        dt.household_id,
        dt.stub_id,
        dt.distribution_date,
        dt.created_at AS distribution_created_at,
        dt.distribution_status,
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
        dti.inventory_item_id,
        ii.item_name,
        ii.unit_of_measure,
        SUM(dti.quantity_released)::integer AS expected_quantity
      FROM distribution_transactions dt
      INNER JOIN distribution_transaction_items dti
        ON dti.distribution_transaction_id = dt.id
      INNER JOIN inventory_items ii
        ON ii.id = dti.inventory_item_id
      INNER JOIN households h
        ON h.id = dt.household_id
      INNER JOIN barangays b
        ON b.id = h.barangay_id
      INNER JOIN disaster_events de
        ON de.id = dt.disaster_event_id
      WHERE ${reconciliationDistributionWhere}
      GROUP BY
        dt.id,
        dt.disaster_event_id,
        dt.household_id,
        dt.stub_id,
        dt.distribution_date,
        dt.created_at,
        dt.distribution_status,
        de.event_code,
        de.title,
        b.id,
        b.name,
        h.family_head_first_name,
        h.family_head_middle_name,
        h.family_head_last_name,
        h.family_head_suffix,
        dti.inventory_item_id,
        ii.item_name,
        ii.unit_of_measure
    ),
    reconciliation_actual AS (
      SELECT
        it.reference_id AS distribution_transaction_id,
        dt.disaster_event_id,
        dt.household_id,
        dt.stub_id,
        dt.distribution_date,
        dt.created_at AS distribution_created_at,
        dt.distribution_status,
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
        ib.inventory_item_id,
        MAX(ii.item_name) AS item_name,
        MAX(ii.unit_of_measure) AS unit_of_measure,
        SUM(it.quantity)::integer AS actual_quantity,
        BOOL_OR(
          dt.id IS NOT NULL
          AND it.disaster_event_id IS NOT NULL
          AND it.disaster_event_id IS DISTINCT FROM dt.disaster_event_id
        ) AS has_event_reference_mismatch,
        MIN(it.performed_at) AS first_outflow_at,
        MAX(it.performed_at) AS last_outflow_at
      FROM inventory_transactions it
      INNER JOIN inventory_batches ib
        ON ib.id = it.inventory_batch_id
      INNER JOIN inventory_items ii
        ON ii.id = ib.inventory_item_id
      INNER JOIN distribution_transactions dt
        ON dt.id = it.reference_id
        AND dt.distribution_status = 'CLAIMED'
      INNER JOIN households h
        ON h.id = dt.household_id
      INNER JOIN barangays b
        ON b.id = h.barangay_id
      INNER JOIN disaster_events de
        ON de.id = dt.disaster_event_id
      WHERE ${reconciliationOutflowWhere}
      GROUP BY
        it.reference_id,
        dt.disaster_event_id,
        dt.household_id,
        dt.stub_id,
        dt.distribution_date,
        dt.created_at,
        dt.distribution_status,
        de.event_code,
        de.title,
        b.id,
        b.name,
        h.family_head_first_name,
        h.family_head_middle_name,
        h.family_head_last_name,
        h.family_head_suffix,
        ib.inventory_item_id
    ),
    reconciliation_item_mismatches AS (
      SELECT
        'INVENTORY_DISTRIBUTION_MISMATCH' AS anomaly_type,
        COALESCE(expected.distribution_transaction_id, actual.distribution_transaction_id)::text AS reference_id,
        'INVENTORY_DISTRIBUTION_RECONCILIATION' AS source_type,
        CONCAT(
          COALESCE(expected.distribution_transaction_id, actual.distribution_transaction_id)::text,
          ':',
          COALESCE(expected.inventory_item_id, actual.inventory_item_id)::text
        ) AS source_id,
        COALESCE(expected.disaster_event_id, actual.disaster_event_id) AS disaster_event_id,
        COALESCE(expected.event_code, actual.event_code) AS event_code,
        COALESCE(expected.disaster_event_title, actual.disaster_event_title) AS disaster_event_title,
        COALESCE(expected.barangay_id, actual.barangay_id) AS barangay_id,
        COALESCE(expected.barangay_name, actual.barangay_name) AS barangay_name,
        COALESCE(expected.family_head_name, actual.family_head_name) AS family_head_name,
        CASE
          WHEN COALESCE(expected.expected_quantity, 0) <= 0
            THEN CONCAT(
              'Distribution-generated outflow for ',
              COALESCE(actual.item_name, 'an inventory item'),
              ' has no matching released distribution item.'
            )
          WHEN COALESCE(actual.actual_quantity, 0) <= 0
            THEN CONCAT(
              'Released distribution item ',
              COALESCE(expected.item_name, 'inventory item'),
              ' expected ',
              expected.expected_quantity,
              ' ',
              COALESCE(expected.unit_of_measure, 'unit(s)'),
              ' but has no matching distribution-generated inventory outflow.'
            )
          WHEN actual.has_event_reference_mismatch
            THEN CONCAT(
              'Distribution-generated inventory outflow for ',
              COALESCE(expected.item_name, actual.item_name, 'inventory item'),
              ' points to the distribution but carries a different disaster event reference.'
            )
          ELSE CONCAT(
            'Released distribution item ',
            COALESCE(expected.item_name, actual.item_name, 'inventory item'),
            ' expected ',
            COALESCE(expected.expected_quantity, 0),
            ' ',
            COALESCE(expected.unit_of_measure, actual.unit_of_measure, 'unit(s)'),
            ' but inventory outflow recorded ',
            COALESCE(actual.actual_quantity, 0),
            '.'
          )
        END AS anomaly_reason,
        'OPEN' AS status,
        COALESCE(
          actual.last_outflow_at,
          expected.distribution_date,
          actual.distribution_date,
          expected.distribution_created_at,
          actual.distribution_created_at
        ) AS occurred_at,
        'Inventory reconciliation review recommended.' AS resolution_status
      FROM reconciliation_expected expected
      FULL OUTER JOIN reconciliation_actual actual
        ON actual.distribution_transaction_id = expected.distribution_transaction_id
        AND actual.inventory_item_id = expected.inventory_item_id
      WHERE COALESCE(expected.expected_quantity, 0) <> COALESCE(actual.actual_quantity, 0)
        OR COALESCE(actual.has_event_reference_mismatch, FALSE) = TRUE
    ),
    reconciliation_orphan_outflows AS (
      SELECT
        'INVENTORY_DISTRIBUTION_MISMATCH' AS anomaly_type,
        COALESCE(it.reference_id::text, it.id::text) AS reference_id,
        'INVENTORY_DISTRIBUTION_ORPHAN_OUTFLOW' AS source_type,
        it.id::text AS source_id,
        de.id AS disaster_event_id,
        de.event_code,
        de.title AS disaster_event_title,
        b.id AS barangay_id,
        b.name AS barangay_name,
        NULLIF(TRIM(CONCAT_WS(
          ' ',
          h.family_head_first_name,
          h.family_head_middle_name,
          h.family_head_last_name,
          h.family_head_suffix
        )), '') AS family_head_name,
        CASE
          WHEN it.reference_id IS NULL
            THEN 'Distribution-generated inventory outflow is missing its distribution reference.'
          WHEN dt.id IS NULL
            THEN 'Distribution-generated inventory outflow references a distribution transaction that does not exist.'
          ELSE CONCAT(
            'Distribution-generated inventory outflow references a ',
            COALESCE(dt.distribution_status, 'non-terminal'),
            ' distribution instead of a claimed distribution.'
          )
        END AS anomaly_reason,
        'OPEN' AS status,
        it.performed_at AS occurred_at,
        'Inventory reconciliation review recommended.' AS resolution_status
      FROM inventory_transactions it
      INNER JOIN inventory_batches ib
        ON ib.id = it.inventory_batch_id
      LEFT JOIN distribution_transactions dt
        ON dt.id = it.reference_id
      LEFT JOIN households h
        ON h.id = dt.household_id
      LEFT JOIN barangays b
        ON b.id = h.barangay_id
      LEFT JOIN disaster_events de
        ON de.id = COALESCE(dt.disaster_event_id, it.disaster_event_id)
      WHERE ${reconciliationOutflowWhere}
        AND (
          it.reference_id IS NULL
          OR dt.id IS NULL
          OR dt.distribution_status <> 'CLAIMED'
        )
    ),
    inventory_distribution_mismatch AS (
      SELECT * FROM reconciliation_item_mismatches
      UNION ALL
      SELECT * FROM reconciliation_orphan_outflows
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
    error_context AS (
      SELECT
        el.*,
        CASE
          WHEN (el.context_json->>'disaster_event_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (el.context_json->>'disaster_event_id')::uuid
          ELSE NULL
        END AS context_disaster_event_id
      FROM error_logs el
      WHERE el.module_name IN ('distribution', 'stubs', 'household-registration')
    ),
    error_barangay_attribution AS (
      SELECT
        el.id AS error_log_id,
        COALESCE(
          h_direct.disaster_event_id,
          s_error.disaster_event_id,
          CASE
            WHEN el.context_disaster_event_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM disaster_event_barangays deb_context
                WHERE deb_context.disaster_event_id = el.context_disaster_event_id
                  AND deb_context.barangay_id = COALESCE(
                    h_direct.barangay_id,
                    h_error.barangay_id,
                    CASE
                      WHEN u.default_barangay_id IS NOT NULL
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
                  )
              )
            THEN el.context_disaster_event_id
            ELSE NULL
          END
        ) AS disaster_event_id,
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
      FROM error_context el
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
    ),
    sync_failed AS (
      SELECT
        'SYNC_FAILED' AS anomaly_type,
        st.id::text AS reference_id,
        'SYNC_TRANSACTION' AS source_type,
        st.id::text AS source_id,
        de.id AS disaster_event_id,
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
        de.id AS disaster_event_id,
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
        de.id AS disaster_event_id,
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
        de.id AS disaster_event_id,
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
        de.id AS disaster_event_id,
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
        ${barangayVerificationNoiseExclusion}
        ${errorWhere}
    ),
    anomaly_rows AS (
      SELECT * FROM suspicious_distribution
      UNION ALL
      SELECT * FROM sync_conflict
      UNION ALL
      SELECT * FROM duplicate_claim_attempts
      UNION ALL
      SELECT * FROM duplicate_household_registration
      UNION ALL
      SELECT * FROM inventory_distribution_mismatch
      UNION ALL
      SELECT * FROM failed_stub_verification
      ${isBarangayScope ? "" : "UNION ALL SELECT * FROM sync_failed"}
    ),
    filtered_anomalies AS (
      SELECT
        anomaly_rows.*,
        ar.id AS review_id,
        ar.review_status,
        ar.resolution_reason,
        ar.reviewed_by,
        ar.reviewed_at,
        ar.created_at AS review_created_at,
        ar.updated_at AS review_updated_at,
        NULLIF(TRIM(CONCAT_WS(
          ' ',
          reviewer.first_name,
          reviewer.middle_name,
          reviewer.last_name
        )), '') AS reviewer_name,
        ${getAnomalyReviewStateExpression({ anomalyAlias: "anomaly_rows", reviewAlias: "ar" })} AS review_state,
        ${getManualReviewAllowedExpression("anomaly_rows")} AS manual_review_allowed
      FROM anomaly_rows
      LEFT JOIN anomaly_reviews ar
        ON ar.source_type = anomaly_rows.source_type
        AND ar.source_id = anomaly_rows.source_id
        AND ar.anomaly_type = anomaly_rows.anomaly_type
        AND ar.barangay_id = anomaly_rows.barangay_id
      LEFT JOIN users reviewer
        ON reviewer.id = ar.reviewed_by
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
        source_type,
        source_id,
        disaster_event_id,
        event_code,
        disaster_event_title,
        barangay_id,
        barangay_name,
        family_head_name,
        anomaly_reason,
        status,
        occurred_at,
        resolution_status,
        review_id,
        review_status,
        resolution_reason,
        reviewed_by,
        reviewed_at,
        review_created_at,
        review_updated_at,
        reviewer_name,
        review_state,
        manual_review_allowed
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

const findAnomalyBySourceIdentity = async ({
  barangayId,
  anomalyType,
  sourceType,
  sourceId,
  roleScope = "BARANGAY",
}) => {
  const result = await getMswdoAnomalyTracking({
    barangayId,
    anomalyType,
    sourceType,
    sourceId,
    roleScope,
    page: 1,
    pageSize: 1,
  });

  return result.items[0] || null;
};

const upsertAnomalyReview = async ({
  sourceType,
  sourceId,
  anomalyType,
  barangayId,
  disasterEventId = null,
  reviewStatus,
  resolutionReason,
  reviewedBy,
}) => {
  const query = `
    INSERT INTO anomaly_reviews (
      source_type,
      source_id,
      anomaly_type,
      barangay_id,
      disaster_event_id,
      review_status,
      resolution_reason,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
    ON CONFLICT (source_type, source_id, anomaly_type, barangay_id)
    DO UPDATE SET
      disaster_event_id = EXCLUDED.disaster_event_id,
      review_status = EXCLUDED.review_status,
      resolution_reason = EXCLUDED.resolution_reason,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;

  const result = await pool.query(query, [
    sourceType,
    sourceId,
    anomalyType,
    barangayId,
    disasterEventId,
    reviewStatus,
    resolutionReason,
    reviewedBy,
  ]);

  return result.rows[0];
};

module.exports = {
  getDisasterEventReportSummary,
  getMswdoAnomalyTracking,
  findAnomalyBySourceIdentity,
  upsertAnomalyReview,
};
