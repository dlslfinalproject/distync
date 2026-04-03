const pool = require("../config/db");

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
    INNER JOIN barangays b ON b.id = h.barangay_id
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
      h.registered_at,
      h.barangay_id,
      b.code AS barangay_code,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN disaster_events de ON de.id = s.disaster_event_id
    INNER JOIN households h ON h.id = s.household_id
    INNER JOIN barangays b ON b.id = h.barangay_id
    WHERE s.id = $1
  `;

  const result = await pool.query(query, [id]);
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
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.contact_number,
      h.barangay_id,
      b.name AS barangay_name
    FROM stubs s
    INNER JOIN households h ON h.id = s.household_id
    INNER JOIN barangays b ON b.id = h.barangay_id
    WHERE s.${field} = $1
  `;

  const result = await pool.query(query, [value]);
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

const getHouseholdMembersCount = async (householdId) => {
  const query = `
    SELECT COUNT(*)::int AS members_count
    FROM evacuees
    WHERE household_id = $1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0]?.members_count || 0;
};

module.exports = {
  getStubSearchResults,
  getStubById,
  getStubByStubNoOrSerialNo,
  getHouseholdSectorsByHouseholdId,
  getHouseholdMembersCount,
};
