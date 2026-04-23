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

const getUserBarangayScopeById = async (userId) => {
  const query = `
    SELECT
      u.id,
      u.default_barangay_id,
      r.code AS role_code
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1
    ORDER BY ur.assigned_at ASC NULLS LAST
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

const getEvacuationCenterById = async (id) => {
  const query = `
    SELECT
      ec.id,
      ec.barangay_id,
      ec.name,
      ec.individual_capacity,
      ec.is_active,
      b.code AS barangay_code,
      b.name AS barangay_name
    FROM evacuation_centers ec
    INNER JOIN barangays b ON b.id = ec.barangay_id
    WHERE ec.id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getDisasterEventBarangayLink = async (disasterEventId, barangayId) => {
  const query = `
    SELECT
      disaster_event_id,
      barangay_id
    FROM disaster_event_barangays
    WHERE disaster_event_id = $1
      AND barangay_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
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

const getSectorsByCodes = async (sectorCodes) => {
  if (sectorCodes.length === 0) {
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
    WHERE code = ANY($1::text[])
    ORDER BY sector_group ASC, name ASC
  `;

  const result = await pool.query(query, [sectorCodes]);
  return result.rows;
};

const generateStubNumbers = async (dbClient) => {
  const currentYear = new Date().getFullYear();
  const stubPrefix = `STUB-${currentYear}-`;
  const serialPrefix = `SER-${currentYear}-`;
  const advisoryLockNamespace = 4107;

  await dbClient.query(
    "SELECT pg_advisory_xact_lock($1, $2)",
    [advisoryLockNamespace, currentYear],
  );

  const sequenceQuery = `
    SELECT
      COALESCE(
        MAX(CAST(SUBSTRING(stub_no FROM '^STUB-\\d{4}-(\\d{6})$') AS INTEGER)),
        0
      ) + 1 AS next_sequence
    FROM stubs
    WHERE stub_no LIKE $1
  `;

  const sequenceResult = await dbClient.query(sequenceQuery, [`${stubPrefix}%`]);
  const nextSequence = Number(sequenceResult.rows[0]?.next_sequence || 1);
  const paddedSequence = String(nextSequence).padStart(6, "0");

  return {
    stub_no: `${stubPrefix}${paddedSequence}`,
    serial_no: `${serialPrefix}${paddedSequence}`,
  };
};

const insertHousehold = async (householdData, dbClient) => {
  const query = `
    INSERT INTO households (
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    )
    RETURNING
      id,
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      residency_status,
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
    householdData.residency_status,
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
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

const insertEvacuationLog = async (logData, dbClient) => {
  const query = `
    INSERT INTO evacuation_logs (
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
    )
    VALUES ($1, $2, $3, $4, NOW(), NULL, $5, $6, $7, NOW(), NOW())
    RETURNING
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
  `;

  const values = [
    logData.disaster_event_id,
    logData.household_id,
    logData.evacuee_id,
    logData.evacuation_center_id,
    logData.status,
    logData.recorded_by,
    logData.remarks,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const getActiveEvacuationLogsByHouseholdId = async (householdId, dbClient = pool) => {
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
      AND status = 'PRESENT'
      AND time_out IS NULL
    ORDER BY time_in DESC, created_at DESC
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

const markHouseholdDeparture = async (
  householdId,
  departureDetails,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET
      time_out = NOW(),
      status = 'LEFT',
      remarks = COALESCE($2, remarks),
      updated_at = NOW()
    WHERE household_id = $1
      AND status = 'PRESENT'
      AND time_out IS NULL
    RETURNING
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
  `;

  const result = await dbClient.query(query, [
    householdId,
    departureDetails.remarks ?? null,
  ]);

  return result.rows;
};

const getHouseholdSummaryById = async (id) => {
  const query = `
    SELECT
      h.id,
      h.disaster_event_id,
      h.barangay_id,
      h.evacuation_center_id,
      h.residency_status,
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
    LEFT JOIN barangays b ON b.id = h.barangay_id
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
  getUserBarangayScopeById,
  getEvacuationCenterById,
  getDisasterEventBarangayLink,
  getSectorsByIds,
  getSectorsByCodes,
  generateStubNumbers,
  insertHousehold,
  insertEvacuee,
  updateHouseholdFamilyHeadEvacueeId,
  insertEvacueeSectors,
  insertHouseholdSectors,
  insertStub,
  insertEvacuationLog,
  getActiveEvacuationLogsByHouseholdId,
  markHouseholdDeparture,
  getHouseholdSummaryById,
  getEvacueesByHouseholdId,
  getEvacueeSectorAssignmentsByHouseholdId,
  getHouseholdSectorAssignmentsByHouseholdId,
  getStubByHouseholdId,
};
