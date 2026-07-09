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

const getActiveEvacuationCentersByBarangayId = async (barangayId) => {
  const query = `
    SELECT
      ec.id,
      ec.barangay_id,
      ec.name,
      ec.individual_capacity,
      ec.is_active
    FROM evacuation_centers ec
    WHERE ec.barangay_id = $1
      AND ec.is_active = TRUE
    ORDER BY ec.name ASC, ec.created_at ASC
  `;

  const result = await pool.query(query, [barangayId]);
  return result.rows;
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
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
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
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
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
    householdData.contact_number ?? householdData.family_head.contact_number ?? null,
    householdData.current_stay_type,
    householdData.current_address_details,
    householdData.household_size,
    true,
    householdData.registered_by,
    householdData.family_head_photo_url || null,
    householdData.photo_captured_at || null,
    householdData.photo_captured_by || null,
    householdData.photo_verification_notes || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateHousehold = async (householdId, householdData, dbClient) => {
  const query = `
    UPDATE households
    SET
      evacuation_center_id = $2,
      residency_status = $3,
      family_head_first_name = $4,
      family_head_middle_name = $5,
      family_head_last_name = $6,
      family_head_suffix = $7,
      sex = $8,
      contact_number = $9,
      current_stay_type = $10,
      current_address_details = $11,
      household_size = $12,
      family_head_photo_url = $13,
      photo_captured_at = $14,
      photo_captured_by = $15,
      photo_verification_notes = $16,
      updated_at = NOW()
    WHERE id = $1
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
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const values = [
    householdId,
    householdData.evacuation_center_id,
    householdData.residency_status,
    householdData.family_head.first_name,
    householdData.family_head.middle_name,
    householdData.family_head.last_name,
    householdData.family_head.suffix,
    householdData.family_head.sex,
    householdData.contact_number ?? householdData.family_head.contact_number ?? null,
    householdData.current_stay_type,
    householdData.current_address_details ?? null,
    householdData.household_size,
    householdData.family_head_photo_url || null,
    householdData.photo_captured_at || null,
    householdData.photo_captured_by || null,
    householdData.photo_verification_notes || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
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

const updateEvacuee = async (evacueeId, member, dbClient) => {
  const query = `
    UPDATE evacuees
    SET
      first_name = $2,
      middle_name = $3,
      last_name = $4,
      suffix = $5,
      sex = $6,
      birth_date = $7,
      age = $8,
      age_value = $9,
      age_unit = $10,
      civil_status = $11,
      relationship_to_head = $12,
      is_family_head = $13,
      is_pregnant = $14,
      is_lactating = $15,
      has_disability = $16,
      is_active = $17,
      updated_at = NOW()
    WHERE id = $1
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
    evacueeId,
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
    member.is_active ?? true,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
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

const deleteEvacueeSectorsByEvacueeId = async (evacueeId, dbClient) => {
  await dbClient.query(
    `
      DELETE FROM evacuee_sectors
      WHERE evacuee_id = $1
    `,
    [evacueeId],
  );
};

const deleteHouseholdSectorsByHouseholdId = async (householdId, dbClient) => {
  await dbClient.query(
    `
      DELETE FROM household_sectors
      WHERE household_id = $1
    `,
    [householdId],
  );
};

const deactivateEvacuee = async (evacueeId, dbClient) => {
  const result = await dbClient.query(
    `
      UPDATE evacuees
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [evacueeId],
  );

  return result.rows[0] || null;
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
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
      issued_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW(), NOW())
    RETURNING
      id,
      disaster_event_id,
      household_id,
      stub_no,
      serial_no,
      status,
      issued_by,
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
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
    stubData.qr_code_value,
    stubData.qr_generated_by,
    stubData.qr_status,
    stubData.qr_notes ?? null,
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
      h.family_head_photo_url,
      h.photo_captured_at,
      h.photo_captured_by,
      h.photo_verification_notes,
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

const getEvacueesByHouseholdId = async (
  householdId,
  { includeInactive = false } = {},
) => {
  const activeFilterClause = includeInactive ? "" : "AND is_active = TRUE";
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
      ${activeFilterClause}
    ORDER BY created_at ASC, first_name ASC, last_name ASC
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows;
};

const getEvacueeSectorAssignmentsByHouseholdId = async (
  householdId,
  { includeInactive = false } = {},
) => {
  const activeFilterClause = includeInactive ? "" : "AND e.is_active = TRUE";
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
      ${activeFilterClause}
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
      qr_code_value,
      qr_generated_at,
      qr_generated_by,
      qr_status,
      qr_notes,
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

const getLatestAttendanceByHouseholdId = async (householdId) => {
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
    ORDER BY
      COALESCE(time_out, time_in) DESC,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [householdId]);
  return result.rows[0] || null;
};

const getLatestDistributionTransactionByStubId = async (stubId) => {
  if (!stubId) {
    return null;
  }

  const query = `
    SELECT
      id,
      disaster_event_id,
      household_id,
      stub_id,
      distribution_date,
      distribution_status,
      claimed_by_name,
      receipt_no,
      receipt_status,
      received_at,
      qr_reference_value,
      qr_scanned_at,
      created_at,
      updated_at
    FROM distribution_transactions
    WHERE stub_id = $1
    ORDER BY distribution_date DESC, created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [stubId]);
  return result.rows[0] || null;
};

const getEvacuationLogByIdForHousehold = async (
  householdId,
  evacuationLogId,
  dbClient = pool,
) => {
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
      AND id = $2
    LIMIT 1
  `;

  const result = await dbClient.query(query, [householdId, evacuationLogId]);
  return result.rows[0] || null;
};

const updateEvacuationLogCorrection = async (
  evacuationLogId,
  correctionData,
  dbClient = pool,
) => {
  const query = `
    UPDATE evacuation_logs
    SET
      evacuation_center_id = $2,
      status = $3,
      time_out = CASE
        WHEN $3 = 'PRESENT' THEN NULL
        WHEN $3 IN ('LEFT', 'TRANSFERRED') AND time_out IS NULL THEN NOW()
        ELSE time_out
      END,
      remarks = $4,
      updated_at = NOW()
    WHERE id = $1
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
    evacuationLogId,
    correctionData.evacuation_center_id,
    correctionData.status,
    correctionData.remarks,
  ]);

  return result.rows[0] || null;
};

const archiveHousehold = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE households
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE id = $1
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
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows[0] || null;
};

const deactivateEvacueesByHouseholdId = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE evacuees
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE household_id = $1
      AND is_active = TRUE
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

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

const restoreHousehold = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE households
    SET
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = $1
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
      family_head_photo_url,
      photo_captured_at,
      photo_captured_by,
      photo_verification_notes,
      registered_at,
      updated_at,
      family_head_evacuee_id
  `;

  const result = await dbClient.query(query, [householdId]);
  return result.rows[0] || null;
};

const reactivateEvacueesByHouseholdId = async (householdId, dbClient = pool) => {
  const query = `
    UPDATE evacuees
    SET
      is_active = TRUE,
      updated_at = NOW()
    WHERE household_id = $1
      AND is_active = FALSE
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

  const result = await dbClient.query(query, [householdId]);
  return result.rows;
};

module.exports = {
  getDisasterEventById,
  getBarangayById,
  getUserBarangayScopeById,
  getEvacuationCenterById,
  getActiveEvacuationCentersByBarangayId,
  getDisasterEventBarangayLink,
  getSectorsByIds,
  getSectorsByCodes,
  generateStubNumbers,
  insertHousehold,
  updateHousehold,
  insertEvacuee,
  updateEvacuee,
  updateHouseholdFamilyHeadEvacueeId,
  insertEvacueeSectors,
  deleteEvacueeSectorsByEvacueeId,
  insertHouseholdSectors,
  deleteHouseholdSectorsByHouseholdId,
  deactivateEvacuee,
  insertStub,
  insertEvacuationLog,
  getActiveEvacuationLogsByHouseholdId,
  markHouseholdDeparture,
  getHouseholdSummaryById,
  getEvacueesByHouseholdId,
  getEvacueeSectorAssignmentsByHouseholdId,
  getHouseholdSectorAssignmentsByHouseholdId,
  getStubByHouseholdId,
  getLatestAttendanceByHouseholdId,
  getLatestDistributionTransactionByStubId,
  getEvacuationLogByIdForHousehold,
  updateEvacuationLogCorrection,
  archiveHousehold,
  deactivateEvacueesByHouseholdId,
  restoreHousehold,
  reactivateEvacueesByHouseholdId,
};
