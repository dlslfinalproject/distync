const pool = require("../config/db");

const getDisasterEventSummaryById = async (id) => {
  const query = `
    SELECT
      id,
      event_code,
      title,
      disaster_type,
      status
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getBarangaySummaryById = async (id) => {
  const query = `
    SELECT
      id,
      code,
      name,
      municipality_name,
      province_name,
      is_active
    FROM barangays
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getHouseholdsByFilters = async (disasterEventId, barangayId = null) => {
  const values = [disasterEventId];
  let barangayFilterClause = "";

  if (barangayId) {
    values.push(barangayId);
    barangayFilterClause = "AND h.barangay_id = $2";
  }

  const query = `
    SELECT
      h.id AS household_id,
      h.disaster_event_id,
      h.barangay_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.current_stay_type,
      h.current_address_details,
      h.contact_number,
      h.registered_at,
      h.family_head_evacuee_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      b.municipality_name,
      b.province_name
    FROM households h
    INNER JOIN barangays b ON b.id = h.barangay_id
    WHERE h.disaster_event_id = $1
    ${barangayFilterClause}
    ORDER BY h.registered_at DESC, h.family_head_last_name ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getStubsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (household_id)
      id,
      household_id,
      stub_no,
      serial_no,
      status
    FROM stubs
    WHERE household_id = ANY($1::uuid[])
    ORDER BY household_id, issued_at DESC, updated_at DESC
  `;

  const result = await pool.query(query, [householdIds]);
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

const getMembersByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

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
    WHERE household_id = ANY($1::uuid[])
    ORDER BY household_id ASC, is_family_head DESC, created_at ASC
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

const getLatestAttendanceByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      ranked.household_id,
      ranked.status,
      ranked.time_in,
      ranked.time_out,
      ranked.evacuation_center_id
    FROM (
      SELECT
        el.household_id,
        el.status,
        el.time_in,
        el.time_out,
        el.evacuation_center_id,
        ROW_NUMBER() OVER (
          PARTITION BY el.household_id
          ORDER BY el.created_at DESC, el.time_in DESC
        ) AS row_number
      FROM evacuation_logs el
      WHERE el.household_id = ANY($1::uuid[])
    ) ranked
    WHERE ranked.row_number = 1
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

module.exports = {
  getDisasterEventSummaryById,
  getBarangaySummaryById,
  getHouseholdsByFilters,
  getStubsByHouseholdIds,
  getHouseholdSectorsByHouseholdIds,
  getMembersByHouseholdIds,
  getMemberSectorsByHouseholdIds,
  getLatestAttendanceByHouseholdIds,
};
