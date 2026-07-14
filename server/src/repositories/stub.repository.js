const pool = require("../config/db");

const stubSequenceSelect = `
      (
        SELECT COUNT(*)::int
        FROM stubs sequence_stubs
        INNER JOIN households sequence_households
          ON sequence_households.id = sequence_stubs.household_id
        WHERE sequence_stubs.disaster_event_id = s.disaster_event_id
          AND sequence_households.barangay_id IS NOT DISTINCT FROM h.barangay_id
          AND sequence_households.current_stay_type = 'EVAC_CENTER'
          AND sequence_stubs.status IN ('ISSUED', 'CLAIMED')
          AND (
            sequence_stubs.issued_at < s.issued_at
            OR (
              sequence_stubs.issued_at = s.issued_at
              AND sequence_stubs.id <= s.id
            )
          )
      ) AS stub_sequence_no`;

const getStubDashboardMetrics = async (disasterEventId, barangayId) => {
  const query = `
    WITH latest_household_stays AS (
      SELECT
        ranked.household_id,
        ranked.status,
        ranked.time_out
      FROM (
        SELECT
          el.household_id,
          el.status,
          el.time_out,
          ROW_NUMBER() OVER (
            PARTITION BY el.household_id
            ORDER BY
              COALESCE(el.time_out, el.time_in) DESC,
              el.updated_at DESC,
              el.created_at DESC
          ) AS row_number
        FROM evacuation_logs el
        INNER JOIN households h ON h.id = el.household_id
        WHERE el.disaster_event_id = $1
          AND h.barangay_id = $2
      ) ranked
      WHERE ranked.row_number = 1
    )
    SELECT
      COUNT(s.id)::int AS total_issued_stubs,
      COUNT(*) FILTER (WHERE s.status = 'CLAIMED')::int AS claimed_stubs,
      COUNT(*) FILTER (WHERE s.status = 'ISSUED')::int AS unclaimed_stubs,
      COUNT(DISTINCT s.household_id) FILTER (
        WHERE h.current_stay_type = 'EVAC_CENTER'
          AND latest_household_stays.status = 'PRESENT'
          AND latest_household_stays.time_out IS NULL
      )::int AS beneficiary_families
    FROM stubs s
    JOIN households h ON h.id = s.household_id
    LEFT JOIN latest_household_stays
      ON latest_household_stays.household_id = s.household_id
    WHERE s.disaster_event_id = $1
      AND h.barangay_id = $2
      AND h.current_stay_type = 'EVAC_CENTER'
      AND s.status IN ('ISSUED', 'CLAIMED')
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return result.rows[0] || {
    total_issued_stubs: 0,
    claimed_stubs: 0,
    unclaimed_stubs: 0,
    beneficiary_families: 0,
  };
};

const getBarangayStubDashboardRows = async (disasterEventId, barangayId) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_at,
      s.updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      h.barangay_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_verification_notes,
      (
        SELECT COUNT(*)::int
        FROM evacuees e
        WHERE e.household_id = h.id
      ) AS members_count,
      ${stubSequenceSelect}
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.disaster_event_id = $1
      AND h.barangay_id = $2
      AND h.current_stay_type = 'EVAC_CENTER'
      AND s.status IN ('ISSUED', 'CLAIMED')
    ORDER BY stub_sequence_no ASC
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return result.rows;
};

const getStubSearchResults = async (q, disasterEventId = null, barangayId = null) => {
  const values = [`%${q.trim()}%`];
  const filters = [];

  if (disasterEventId) {
    values.push(disasterEventId);
    filters.push(`s.disaster_event_id = $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
    filters.push(`h.barangay_id = $${values.length}`);
  }

  const optionalWhereClause =
    filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";

  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      ${stubSequenceSelect},
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.contact_number,
      h.household_size,
      h.barangay_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      de.event_code,
      de.title AS disaster_event_title,
      (
        SELECT COUNT(*)::int
        FROM evacuees e
        WHERE e.household_id = h.id
      ) AS members_count
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    WHERE (
      s.stub_no ILIKE $1
      OR s.serial_no ILIKE $1
      OR CONCAT_WS(
        ' ',
        h.family_head_first_name,
        h.family_head_middle_name,
        h.family_head_last_name,
        h.family_head_suffix
      ) ILIKE $1
      OR h.contact_number ILIKE $1
    )
    ${optionalWhereClause}
    ORDER BY s.issued_at DESC, s.stub_no ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getStubById = async (id) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_by,
      s.issued_at,
      s.claimed_at,
      s.updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      ${stubSequenceSelect},
      de.event_code,
      de.title AS disaster_event_title,
      de.disaster_type,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.residency_status,
      h.contact_number,
      h.current_stay_type,
      h.current_address_details,
      h.is_active,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_captured_by,
      h.photo_verification_notes,
      h.registered_at,
      h.barangay_id,
      b.code AS barangay_code,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    WHERE s.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getScopedStubById = async (id, barangayId) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.claimed_at,
      s.updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      ${stubSequenceSelect},
      h.barangay_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.id = $1
      AND h.barangay_id = $2
      AND h.current_stay_type = 'EVAC_CENTER'
  `;

  const result = await pool.query(query, [id, barangayId]);
  return result.rows[0] || null;
};

const getStubByStubNoOrSerialNo = async ({ stub_no, serial_no }) => {
  const value = stub_no || serial_no;
  const field = stub_no ? "stub_no" : "serial_no";

  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_by,
      s.issued_at,
      s.claimed_at,
      s.updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      ${stubSequenceSelect},
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_verification_notes,
      h.household_size,
      h.contact_number,
      h.barangay_id,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    WHERE s.${field} = $1
  `;

  const result = await pool.query(query, [value]);
  return result.rows[0] || null;
};

const getStubByQrCodeValue = async (qrCodeValue) => {
  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_by,
      s.issued_at,
      s.claimed_at,
      s.updated_at,
      s.qr_code_value,
      s.qr_generated_at,
      s.qr_generated_by,
      s.qr_status,
      s.qr_notes,
      ${stubSequenceSelect},
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.contact_number,
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_verification_notes,
      h.barangay_id,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    WHERE s.qr_code_value = $1
  `;

  const result = await pool.query(query, [qrCodeValue]);
  return result.rows[0] || null;
};

const getHouseholdSectorsByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      s.id,
      s.code,
      s.name
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = $1
    ORDER BY s.name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getHouseholdSectorsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      hs.household_id,
      s.id,
      s.code,
      s.name
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = ANY($1::uuid[])
    ORDER BY s.name ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getMemberSectorsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      e.household_id,
      es.evacuee_id,
      s.id,
      s.code,
      s.name
    FROM evacuee_sectors es
    INNER JOIN evacuees e ON e.id = es.evacuee_id
    INNER JOIN sectors s ON s.id = es.sector_id
    WHERE e.household_id = ANY($1::uuid[])
    ORDER BY e.household_id ASC, s.name ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getHouseholdMembersCount = async (householdId) => {
  const query = `
    SELECT COUNT(*)::int AS members_count
    FROM evacuees
    WHERE household_id = $1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0]?.members_count || 0;
};

const getHouseholdMembersByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      id AS evacuee_id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      age,
      age_value,
      age_unit,
      relationship_to_head,
      is_family_head
    FROM evacuees
    WHERE household_id = $1
    ORDER BY is_family_head DESC, created_at ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getLatestAttendanceByHouseholdId = async (householdId, disasterEventId = null) => {
  const values = [householdId];
  let disasterEventFilter = "";

  if (disasterEventId) {
    values.push(disasterEventId);
    disasterEventFilter = `AND disaster_event_id = $${values.length}`;
  }

  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      evacuee_id,
      evacuation_center_id,
      time_in,
      time_out,
      status,
      recorded_by,
      remarks,
      created_at,
      updated_at
    FROM evacuation_logs
    WHERE household_id = $1
      ${disasterEventFilter}
    ORDER BY
      COALESCE(time_out, time_in) DESC,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const getLatestDistributionTransactionByStubId = async (stubId) => {
  if (!stubId) {
    return null;
  }

  const query = `
    SELECT
      dt.id,
      dt.disaster_event_id,
      dt.household_id,
      dt.stub_id,
      dt.distribution_date,
      dt.distribution_status,
      dt.claimed_by_name,
      dt.receipt_no,
      dt.receipt_status,
      dt.received_at,
      dt.qr_reference_value,
      dt.qr_scanned_at,
      dt.relief_pack_template_id,
      rpt.name AS relief_pack_template_name,
      dt.created_at,
      dt.updated_at
    FROM distribution_transactions dt
    LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
    WHERE dt.stub_id = $1
    ORDER BY dt.distribution_date DESC, dt.created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [stubId]);
  return result.rows[0] || null;
};

const updateStubQrMetadata = async (stubId, qrMetadata, dbClient = pool) => {
  const query = `
    UPDATE stubs
    SET
      qr_code_value = $2,
      qr_generated_at = COALESCE($3, NOW()),
      qr_generated_by = $4,
      qr_status = $5,
      qr_notes = $6,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      issued_at,
      claimed_at,
      updated_at,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes
  `;

  const values = [
    stubId,
    qrMetadata.qr_code_value,
    qrMetadata.qr_generated_at || null,
    qrMetadata.qr_generated_by || null,
    qrMetadata.qr_status,
    qrMetadata.qr_notes ?? null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const markStubAsClaimed = async (stubId) => {
  const query = `
    UPDATE stubs
    SET status = 'CLAIMED',
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      status,
      claimed_at,
      updated_at
  `;

  const result = await pool.query(query, [stubId]);
  return result.rows[0] || null;
};

const getStubClaimHistory = async ({
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
    conditions.push(`s.disaster_event_id = $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
    conditions.push(`h.barangay_id = $${values.length}`);
  }

  if (status === "CLAIMED") {
    conditions.push(`s.status = 'CLAIMED'`);
  } else if (status === "UNCLAIMED") {
    conditions.push(`s.status = 'ISSUED'`);
  } else if (status === "INVALID") {
    conditions.push(`s.status IN ('VOID', 'CANCELLED')`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`COALESCE(dt.distribution_date, s.issued_at) >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(
      `COALESCE(dt.distribution_date, s.issued_at) < ($${values.length}::date + INTERVAL '1 day')`,
    );
  }

  values.push(limit);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      s.id,
      s.disaster_event_id,
      s.household_id,
      s.stub_no,
      s.serial_no,
      s.status,
      s.issued_at,
      s.claimed_at,
      s.qr_code_value,
      s.qr_status,
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
      dt.id AS distribution_transaction_id,
      dt.distribution_date,
      dt.claimed_by_name,
      dt.distribution_status,
      dt.qr_reference_value,
      dt.receipt_no,
      dt.remarks,
      CONCAT_WS(
        ' ',
        u.first_name,
        u.middle_name,
        u.last_name
      ) AS recorded_by_name,
      rpt.name AS relief_pack_template_name,
      COALESCE(item_summary.total_quantity_released, 0) AS total_quantity_released,
      COALESCE(item_summary.released_items_summary, '') AS released_items_summary
    FROM stubs s
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    INNER JOIN households h ON h.id = s.household_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    LEFT JOIN LATERAL (
      SELECT
        dt_inner.*
      FROM distribution_transactions dt_inner
      WHERE dt_inner.stub_id = s.id
      ORDER BY dt_inner.distribution_date DESC, dt_inner.created_at DESC
      LIMIT 1
    ) dt ON TRUE
    LEFT JOIN users u ON u.id = dt.verified_by
    LEFT JOIN relief_pack_templates rpt ON rpt.id = dt.relief_pack_template_id
    LEFT JOIN LATERAL (
      SELECT
        SUM(dti.quantity_released)::integer AS total_quantity_released,
        STRING_AGG(
          CONCAT(ii.item_name, ' x', dti.quantity_released),
          ', '
          ORDER BY ii.item_name
        ) AS released_items_summary
      FROM distribution_transaction_items dti
      INNER JOIN inventory_items ii ON ii.id = dti.inventory_item_id
      WHERE dti.distribution_transaction_id = dt.id
    ) item_summary ON TRUE
    ${whereClause}
    ORDER BY COALESCE(dt.distribution_date, s.issued_at) DESC, s.updated_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

module.exports = {
  getStubDashboardMetrics,
  getBarangayStubDashboardRows,
  getStubSearchResults,
  getStubById,
  getScopedStubById,
  getStubByStubNoOrSerialNo,
  getStubByQrCodeValue,
  getHouseholdSectorsByHouseholdId,
  getHouseholdSectorsByHouseholdIds,
  getMemberSectorsByHouseholdIds,
  getHouseholdMembersCount,
  getHouseholdMembersByHouseholdId,
  getLatestAttendanceByHouseholdId,
  getLatestDistributionTransactionByStubId,
  updateStubQrMetadata,
  markStubAsClaimed,
  getStubClaimHistory,
};
