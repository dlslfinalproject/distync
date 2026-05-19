const pool = require("../config/db");

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
      ROW_NUMBER() OVER (
        PARTITION BY s.disaster_event_id, h.barangay_id
        ORDER BY s.issued_at ASC, s.updated_at ASC, s.id ASC
      ) AS stub_sequence_no
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.disaster_event_id = $1
      AND h.barangay_id = $2
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
      de.event_code,
      de.title AS disaster_event_title,
      de.disaster_type,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.contact_number,
      h.current_stay_type,
      h.current_address_details,
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
      h.barangay_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    WHERE s.id = $1
      AND h.barangay_id = $2
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
  markStubAsClaimed,
};
