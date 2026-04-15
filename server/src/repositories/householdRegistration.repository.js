const pool = require("../config/db");

const getDisasterEventById = async (id) => {
  const query = `
    SELECT
      id,
      event_code,
      title,
      status
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getBarangayById = async (id) => {
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

const getSectorsByIds = async (sectorIds) => {
  if (sectorIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      id,
      code,
      name,
      description,
      sector_group,
      is_barangay_visible,
      is_mswdo_visible,
      created_at
    FROM sectors
    WHERE id = ANY($1::uuid[])
    ORDER BY sector_group ASC, name ASC
  `;

  const result = await pool.query(query, [sectorIds]);
  return result.rows;
};

const getNextStubSequence = async (year, dbClient) => {
  const stubPrefix = `STUB-${year}-%`;

  const query = `
    SELECT COUNT(*)::int AS total
    FROM stubs
    WHERE stub_no LIKE $1
  `;

  const result = await dbClient.query(query, [stubPrefix]);
  return result.rows[0].total + 1;
};

const insertHousehold = async (householdData, dbClient) => {
  const query = `
    INSERT INTO households (
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      registered_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
    )
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      family_head_first_name,
      family_head_middle_name,
      family_head_last_name,
      family_head_suffix,
      sex,
      birth_date,
      contact_number,
      current_stay_type,
      current_address_details,
      household_size,
      is_active,
      registered_by,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const values = [
    householdData.disaster_event_id,
    householdData.barangay_id,
    householdData.evacuation_center_id,
    householdData.family_head.first_name,
    householdData.family_head.middle_name,
    householdData.family_head.last_name,
    householdData.family_head.suffix,
    householdData.family_head.sex,
    householdData.family_head.birth_date ?? null,
    householdData.family_head.contact_number ?? null,
    householdData.current_stay_type,
    householdData.current_address_details,
    householdData.household_size,
    true,
    householdData.registered_by,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertEvacuee = async (householdId, member, dbClient) => {
  const query = `
    INSERT INTO evacuees (
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      age_group,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
    )
    RETURNING
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      age_group,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    householdId,
    member.first_name,
    member.middle_name,
    member.last_name,
    member.suffix,
    member.sex,
    member.birth_date ?? null,
    member.age ?? null,
    member.age_value,
    member.age_unit,
    member.age_group,
    member.civil_status ?? null,
    member.relationship_to_head,
    member.is_family_head,
    member.is_pregnant,
    member.is_lactating,
    member.has_disability,
    true,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateHouseholdFamilyHeadEvacueeId = async (
  householdId,
  familyHeadEvacueeId,
  dbClient,
) => {
  const query = `
    UPDATE households
    SET family_head_evacuee_id = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId, familyHeadEvacueeId]);
  return result.rows[0] || null;
};

const insertEvacueeSectors = async (evacueeId, sectorIds, dbClient) => {
  const insertedRows = [];

  for (const sectorId of sectorIds) {
    const query = `
      INSERT INTO evacuee_sectors (
        evacuee_id,
        sector_id,
        created_at
      )
      VALUES ($1, $2, NOW())
      RETURNING
        id,
        evacuee_id,
        sector_id,
        created_at
    `;

    const result = await dbClient.query(query, [evacueeId, sectorId]);
    insertedRows.push(result.rows[0]);
  }

  return insertedRows;
};

const insertHouseholdSectors = async (householdId, sectorIds, dbClient) => {
  const insertedRows = [];

  for (const sectorId of sectorIds) {
    const query = `
      INSERT INTO household_sectors (
        household_id,
        sector_id,
        created_at
      )
      VALUES ($1, $2, NOW())
      RETURNING
        id,
        household_id,
        sector_id,
        created_at
    `;

    const result = await dbClient.query(query, [householdId, sectorId]);
    insertedRows.push(result.rows[0]);
  }

  return insertedRows;
};

const insertStub = async (stubData, dbClient) => {
  const query = `
    INSERT INTO stubs (
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      issued_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
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
      updated_at
  `;

  const values = [
    stubData.disaster_event_id,
    stubData.household_id,
    stubData.stub_no,
    stubData.serial_no,
    stubData.status,
    stubData.issued_by,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getHouseholdSummaryById = async (id) => {
  const query = `
    SELECT
      h.id,
      h.disaster_event_id,
      h.barangay_id,
      h.evacuation_center_id,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.sex,
      h.birth_date,
      h.contact_number,
      h.current_stay_type,
      h.current_address_details,
      h.household_size,
      h.is_active,
      h.registered_by,
      h.registered_at,
      h.updated_at,
      h.family_head_evacuee_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      de.event_code,
      de.title AS disaster_event_title
    FROM households h
    INNER JOIN barangays b ON b.id = h.barangay_id
    INNER JOIN disaster_events de ON de.id = h.disaster_event_id
    WHERE h.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getEvacueesByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      birth_date,
      age,
      age_value,
      age_unit,
      age_group,
      civil_status,
      relationship_to_head,
      is_family_head,
      is_pregnant,
      is_lactating,
      has_disability,
      is_active,
      created_at,
      updated_at
    FROM evacuees
    WHERE household_id = $1
    ORDER BY created_at ASC, first_name ASC, last_name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getEvacueeSectorAssignmentsByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      es.evacuee_id,
      s.id AS sector_id,
      s.code,
      s.name,
      s.description,
      s.sector_group
    FROM evacuee_sectors es
    INNER JOIN evacuees e ON e.id = es.evacuee_id
    INNER JOIN sectors s ON s.id = es.sector_id
    WHERE e.household_id = $1
    ORDER BY e.created_at ASC, s.name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getHouseholdSectorAssignmentsByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      s.id,
      s.code,
      s.name,
      s.description,
      s.sector_group
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = $1
    ORDER BY s.name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getStubByHouseholdId = async (householdId) => {
  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      issued_at,
      claimed_at,
      updated_at
    FROM stubs
    WHERE household_id = $1
    ORDER BY issued_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0] || null;
};

module.exports = {
  getDisasterEventById,
  getBarangayById,
  getSectorsByIds,
  getNextStubSequence,
  insertHousehold,
  insertEvacuee,
  updateHouseholdFamilyHeadEvacueeId,
  insertEvacueeSectors,
  insertHouseholdSectors,
  insertStub,
  getHouseholdSummaryById,
  getEvacueesByHouseholdId,
  getEvacueeSectorAssignmentsByHouseholdId,
  getHouseholdSectorAssignmentsByHouseholdId,
  getStubByHouseholdId,
};
